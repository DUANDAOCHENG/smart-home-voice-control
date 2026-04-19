"""
智能家居后端（Python + Flask）
启动：在 backend 目录下执行 python app.py
"""
from flask import Flask, jsonify
from flask_cors import CORS
import whisper

model = whisper.load_model("base") # 轻量版
result = model.transcribe("test.wav", language="zh")

app = Flask(__name__)
CORS(app)


@app.route("/api/health")
def health():
    return jsonify(ok=True, service="smart-home-backend")


if __name__ == "__main__":
    # 与原先 Node 版一致，默认 3000 端口；调试模式会热重载
    app.run(host="0.0.0.0", port=3000, debug=True)
