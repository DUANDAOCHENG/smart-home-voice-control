<<<<<<< HEAD
# 智能家居项目

本目录为单仓库根目录，前后端分文件夹放置：

| 目录 | 说明 |
|------|------|
| `frontend/` | React + Vite + TypeScript + Tailwind 前端 |
| `backend/` | Python + Flask 后端（占位 API） |

## 前端

```bash
cd frontend
npm install
npm run dev
```

默认开发地址以终端输出为准（一般为 `http://localhost:5173`）。

## 后端（Python）

**第一次使用**（建议虚拟环境，避免污染全局 Python）：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

**以后每次启动**：

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python app.py
```

若不用虚拟环境，可直接：

```powershell
cd backend
python -m pip install -r requirements.txt
python app.py
```

默认监听 `http://localhost:3000`，健康检查：在浏览器打开  
`http://localhost:3000/api/health` 应看到 JSON：`{"ok":true,"service":"smart-home-backend"}`。

## 说明

- 若根目录仍残留旧的 `node_modules`，请先关闭占用该目录的进程（如正在运行的 `npm run dev`），再删除根目录下的 `node_modules`；依赖请分别在 `frontend` 与 `backend` 下安装。
=======
# smart-home-voice-control
毕业设计：基于大模型的语音控制智能家居系统
>>>>>>> 17d79a3dbe510fd036043c021ff54e10c7ec3559
