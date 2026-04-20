"""
智能家居后端（Python + Flask）
启动：在 backend 目录下执行 python app.py
"""
from flask import Flask, jsonify
from flask_cors import CORS
import whisper
from zhipuai import ZhipuAI

zhipuai = ZhipuAI(api_key="f84aaf7529854f7ca29d9fee37a35693.xstYH3JtRBT6YtVB")



app = Flask(__name__)
CORS(app，resources={r"/api/*": {"origins": "http://localhost:5173"}})


@app.route("/api/voice-control", methods=["POST"])
def vocie():
 try:
    if 'audio' not in request.files:
        return jsonify(error="No audio file part"), 400
    data = request.files["audio"]

    data.save("fronted.wav")

    model = whisper.load_model("base")
     # 轻量版
    transcribe_result = model.transcribe("fronted.wav", language="zh")

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
    GLM_result = response.choices[0].message.content
    clean_json = _content.replace("```json", "").replace("```", "").strip()
        control_data = json.loads(clean_json)
        return jsonify(control_data)
    except Exception as e:
        return jsonify(error=str(e)), 500


if __name__ == "__main__":
    # 与原先 Node 版一致，默认 3000 端口；调试模式会热重载
    app.run(host="0.0.0.0", port=3000, debug=True)
