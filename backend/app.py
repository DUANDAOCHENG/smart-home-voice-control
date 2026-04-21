"""
智能家居后端（Python + Flask）
启动：在 backend 目录下执行 python app.py
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import whisper
from zhipuai import ZhipuAI
import json
import os
import shutil
from pathlib import Path

zhipuai = ZhipuAI(api_key="f84aaf7529854f7ca29d9fee37a35693.xstYH3JtRBT6YtVB")

# 避免 Windows 下默认 ~/.cache 无权限写入
cache_dir = Path(__file__).resolve().parent / ".cache"
cache_dir.mkdir(parents=True, exist_ok=True)
os.environ["XDG_CACHE_HOME"] = str(cache_dir)



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
          用户说"{result}"，
          请将其转化为智能家居控制指令。
          要求:
          1.  必须只返回 JSON 格式，不要有任何解释文字。
          2.  字段包含：
              "device":(只能是'light' |  'television' | 'air_conditioner' | 'curtain')
              "action":(只能是'on' | 'off' )
          """
        response = zhipuai.chat.completions.create(
            model="glm-4",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        glm_result = response.choices[0].message.content
        clean_json = glm_result.replace("```json", "").replace("```", "").strip()

        try:
            control_data = json.loads(clean_json)
        except json.JSONDecodeError:
            # 大模型偶尔会返回非 JSON，避免直接 500
            control_data = {"device": None, "action": None, "parse_error": "invalid_json"}

        control_data["transcript"] = result
        control_data["model_response"] = glm_result
        return jsonify(control_data)
    except Exception as e:
        return jsonify(error=str(e)), 500


if __name__ == "__main__":
    # 与原先 Node 版一致，默认 3000 端口；调试模式会热重载
    app.run(host="0.0.0.0", port=3000, debug=True)
