from flask import Flask, jsonify, request
from flask_cors import CORS
import whisper
from zhipuai import ZhipuAI
import json
import os
import shutil
import ast
from pathlib import Path
from datetime import datetime
from langchain_community.utilities import SQLDatabase
import paho.mqtt.client as mqtt

zhipuai = ZhipuAI(api_key="f84aaf7529854f7ca29d9fee37a35693.xstYH3JtRBT6YtVB")

# 避免 Windows 下默认 ~/.cache 无权限写入
cache_dir = Path(__file__).resolve().parent / ".cache"
cache_dir.mkdir(parents=True, exist_ok=True)
os.environ["XDG_CACHE_HOME"] = str(cache_dir)

db_path = Path(__file__).resolve().parent / "smart_home.db"
langchain_db = SQLDatabase.from_uri(f"sqlite:///{db_path.as_posix()}")
SUPPORTED_DEVICES = {"light", "fan", "air_conditioner", "curtain", "tv"}
SUPPORTED_ACTIONS = {"on", "off"}
# 当前硬件仅接入灯泡和风扇，只对这两类设备发布 MQTT
MQTT_HARDWARE_DEVICES = {"light", "fan"}
# 默认先走本机 broker，避免未开放局域网端口时触发连接拒绝
MQTT_HOST = os.getenv("MQTT_HOST", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "ddc")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "Ddc@2026mqtt!")
MQTT_TOPIC_PREFIX = os.getenv("MQTT_TOPIC_PREFIX", "smart_home")
STATE_CHANGE_LOG_FILE = Path(__file__).resolve().parent / "device_state_changes.log"


def append_state_change_log(record: dict):
    # JSONL 便于后续按行排查每次状态变更
    record_with_time = {"timestamp": datetime.now().isoformat(timespec="seconds"), **record}
    with STATE_CHANGE_LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record_with_time, ensure_ascii=False) + "\n")


def create_mqtt_client():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=30)
    return client


def publish_device_state_to_mqtt(device: str, status: int):
    topic = f"{MQTT_TOPIC_PREFIX}/{device}/state"
    payload = json.dumps(
        {"device": device, "action": "on" if status == 1 else "off", "value": status},
        ensure_ascii=False,
    )
    client = create_mqtt_client()
    try:
        result = client.publish(topic, payload=payload, qos=1, retain=False)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            raise RuntimeError(f"MQTT publish failed: rc={result.rc}")
        # 避免 publish 后立即 disconnect 导致消息未真正发出
        result.wait_for_publish(timeout=3)
        if not result.is_published():
            raise RuntimeError("MQTT publish timeout before delivery")
    finally:
        client.disconnect()


def init_device_table():
    # 表头：家具、打开状态、对应数值（默认 0）
    langchain_db.run(
        """
        CREATE TABLE IF NOT EXISTS smart_furniture (
            家具 TEXT PRIMARY KEY,
            打开状态 INTEGER NOT NULL DEFAULT 0,
            对应数值 INTEGER NOT NULL DEFAULT 0
        );
        """
    )
    for device in ["light", "fan", "air_conditioner", "curtain", "tv"]:
        langchain_db.run(
            f"""
            INSERT INTO smart_furniture (家具, 打开状态, 对应数值)
            VALUES ('{device}', 0, 0)
            ON CONFLICT(家具) DO NOTHING;
            """
        )


def update_device_state(device: str | None, action: str | None, source: str = "unknown"):
    if device not in SUPPORTED_DEVICES or action not in SUPPORTED_ACTIONS:
        append_state_change_log(
            {
                "source": source,
                "device": device,
                "action": action,
                "status": None,
                "db_updated": False,
                "note": "invalid_device_or_action",
            }
        )
        return
    status = 1 if action == "on" else 0
    langchain_db.run(
        f"""
        INSERT INTO smart_furniture (家具, 打开状态, 对应数值)
        VALUES ('{device}', {status}, {status})
        ON CONFLICT(家具) DO UPDATE SET
            打开状态 = excluded.打开状态,
            对应数值 = excluded.对应数值;
        """
    )
    append_state_change_log(
        {
            "source": source,
            "device": device,
            "action": action,
            "status": status,
            "db_updated": True,
            "mqtt_targeted": device in MQTT_HARDWARE_DEVICES,
        }
    )
    # 数据库更新后同步到 MQTT；仅下发到已接入硬件的设备
    if device in MQTT_HARDWARE_DEVICES:
        try:
            publish_device_state_to_mqtt(device, status)
        except Exception as mqtt_error:
            print(f"[WARN] MQTT publish failed for {device}: {mqtt_error}")
            append_state_change_log(
                {
                    "source": source,
                    "device": device,
                    "action": action,
                    "status": status,
                    "db_updated": True,
                    "mqtt_targeted": True,
                    "mqtt_ok": False,
                    "mqtt_error": str(mqtt_error),
                }
            )
        else:
            append_state_change_log(
                {
                    "source": source,
                    "device": device,
                    "action": action,
                    "status": status,
                    "db_updated": True,
                    "mqtt_targeted": True,
                    "mqtt_ok": True,
                }
            )


def fetch_device_states():
    rows = []
    for device in ["light", "fan", "air_conditioner", "curtain", "tv"]:
        query_result = langchain_db.run(
            f"""
            SELECT 家具, 打开状态, 对应数值
            FROM smart_furniture
            WHERE 家具 = '{device}'
            LIMIT 1;
            """
        )
        if isinstance(query_result, str):
            # 兼容 SQLDatabase 在部分版本下返回字符串，如 "[('light', 1, 1)]"
            try:
                parsed = ast.literal_eval(query_result)
                if parsed and isinstance(parsed, list):
                    row = parsed[0]
                    rows.append({"家具": row[0], "打开状态": row[1], "对应数值": row[2]})
                    continue
            except Exception:
                pass
            rows.append({"家具": device, "打开状态": 0, "对应数值": 0, "raw": query_result})
            continue
        if query_result:
            row = query_result[0]
            rows.append({"家具": row[0], "打开状态": row[1], "对应数值": row[2]})
        else:
            rows.append({"家具": device, "打开状态": 0, "对应数值": 0})
    return rows


init_device_table()

app = Flask(__name__)
CORS(
    app,
    resources={r"/api/*": {"origins": ["http://localhost:5173", "http://localhost:5174"]}},
)


@app.route("/api/voice-control", methods=["POST"])
def vocie():
    try:
        if shutil.which("ffmpeg") is None:
            return jsonify(error="未检测到 ffmpeg，请先安装并加入 PATH"), 500

        if "ddc" not in request.files:
            return jsonify(error="No audio file part"), 400
        data = request.files["ddc"]

        data.save("fronted.wav")

        model = whisper.load_model("base")
        # 轻量版
        try:
            transcribe_result = model.transcribe("fronted.wav", language="zh")
        except FileNotFoundError:
            return jsonify(error="语音转写依赖缺失：ffmpeg 不可用"), 500

        result = transcribe_result["text"]
        prompt = f"""
你是智能家居控制意图解析器。
用户原话："{result}"

请将用户意图转为智能家居控制 JSON。
输出要求：
1) 必须只返回 JSON，不要任何解释文字。
2) 字段必须且仅包含：
   - "device": 只能是 "light" | "fan" | "air_conditioner" | "curtain" | "tv"
   - "action": 只能是 "on" | "off"

语义映射规则（重点）：
- 与“亮度/光线”相关语义默认映射到 light。
- “比较暗/太暗/有点暗/光线不足/看不清” -> device="light", action="on"
- “比较亮/太亮/有点亮/太刺眼/晃眼” -> device="light", action="off"
- 若用户明确提到具体设备（如风扇、窗帘、电视），优先按明确设备解析。

示例：
- "客厅比较暗" -> {{"device":"light","action":"on"}}
- "现在太亮了" -> {{"device":"light","action":"off"}}
- "把风扇打开" -> {{"device":"fan","action":"on"}}
        """
        response = zhipuai.chat.completions.create(
            model="glm-4",
            messages=[{"role": "user", "content": prompt}],
        )
        glm_result = response.choices[0].message.content
        clean_json = glm_result.replace("```json", "").replace("```", "").strip()

        try:
            control_data = json.loads(clean_json)
        except json.JSONDecodeError:
            # 大模型偶尔会返回非 JSON，避免直接 500
            control_data = {"device": None, "action": None, "parse_error": "invalid_json"}

        update_device_state(control_data.get("device"), control_data.get("action"), source="voice-control")
        control_data["transcript"] = result
        control_data["model_response"] = glm_result
        return jsonify(control_data)
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route("/api/device-states", methods=["GET"])
def device_states():
    try:
        return jsonify(data=fetch_device_states())
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route("/api/device-control", methods=["POST"])
def device_control():
    try:
        payload = request.get_json(silent=True) or {}
        device = payload.get("device")
        action = payload.get("action")
        if device not in SUPPORTED_DEVICES or action not in SUPPORTED_ACTIONS:
            return jsonify(error="非法设备或动作"), 400
        update_device_state(device, action, source="device-control")
        return jsonify(ok=True, device=device, action=action)
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route("/api/mqtt/sync-light", methods=["POST"])
def sync_light_to_mqtt():

    try:
        query_result = langchain_db.run(
            """
            SELECT 打开状态
            FROM smart_furniture
            WHERE 家具 = 'light'
            LIMIT 1;
            """
        )
        status = 0
        if isinstance(query_result, str):
            try:
                parsed = ast.literal_eval(query_result)
                if parsed and isinstance(parsed, list):
                    status = int(parsed[0][0])
            except Exception:
                status = 0
        elif query_result:
            status = int(query_result[0][0])
        publish_device_state_to_mqtt("light", status)
        return jsonify(ok=True, device="light", value=status)
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route("/api/mqtt/sync-fan", methods=["POST"])
def sync_fan_to_mqtt():
    """
    当前用于测试风扇：将数据库中的 fan 状态重新发布到 MQTT。
    """
    try:
        query_result = langchain_db.run(
            """
            SELECT 打开状态
            FROM smart_furniture
            WHERE 家具 = 'fan'
            LIMIT 1;
            """
        )
        status = 0
        if isinstance(query_result, str):
            try:
                parsed = ast.literal_eval(query_result)
                if parsed and isinstance(parsed, list):
                    status = int(parsed[0][0])
            except Exception:
                status = 0
        elif query_result:
            status = int(query_result[0][0])
        publish_device_state_to_mqtt("fan", status)
        return jsonify(ok=True, device="fan", value=status)
    except Exception as e:
        return jsonify(error=str(e)), 500


if __name__ == "__main__":
    # 与原先 Node 版一致，默认 3000；若被占用可设环境变量 SMART_HOME_PORT
    _port = int(os.environ.get("SMART_HOME_PORT", "3000"))
    app.run(host="0.0.0.0", port=_port, debug=True)

