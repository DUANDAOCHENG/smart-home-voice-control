# 智能家居语音控制 — 前端

React + Vite + TypeScript + Tailwind。开发时通过 Vite 将 `/api` 代理到后端 Flask（默认 `http://127.0.0.1:3000`）。

## 环境要求

- **Node.js** 18+
- **Python** 3.10+（后端，见 `../backend`）
- 可选：**Mosquitto** MQTT Broker（控制 ESP32 灯/风扇时）

## 第一次使用

### 1. 安装前端依赖

```powershell
cd frontend
npm install
```

### 2. 安装后端依赖（建议使用虚拟环境）

```powershell
cd ..\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

> 首次语音识别会下载 Whisper 模型，缓存目录为 `backend/.cache`。

## 启动顺序（开发环境）

需要 **两个终端**，**必须先启后端，再启前端**。前端页面访问 `/api` 时由 Vite 转发到后端。

| 顺序 | 服务 | 默认地址 |
|------|------|----------|
| 1 | 后端 Flask | http://127.0.0.1:3000 |
| 2 | 前端 Vite | http://127.0.0.1:5173 |

### 终端 1：启动后端

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python app.py
```

验证后端是否正常：

- 浏览器或命令行访问：http://127.0.0.1:3000/api/device-states  
- 应返回 JSON 设备状态

### 终端 2：启动前端

**在后端已监听 3000 端口后**，新开终端：

```powershell
cd frontend
npm run dev
```

浏览器打开：

- **前端页面**：http://127.0.0.1:5173  
- **经代理的 API**（示例）：http://127.0.0.1:5173/api/device-states  

## 端口被占用时

若 **3000** 已被占用，在**两个终端**都设置同一端口后再启动（示例改为 **3001**）：

```powershell
$env:SMART_HOME_PORT = '3001'
```

- 后端：`python app.py` 监听 `3001`
- 前端：`npm run dev` 时 Vite 将 `/api` 代理到 `http://127.0.0.1:3001`

未设置 `SMART_HOME_PORT` 时，后端与代理均使用 **3000**。

## Windows PowerShell 注意

- PowerShell 5.1 不支持 `&&`，请分多行执行，或使用 `;` 分隔。
- 路径含中文时可用：`Set-Location -LiteralPath 'd:\Project\毕业设计\backend'`
- 若 `python` 指向应用商店占位程序，请使用虚拟环境中的解释器：  
  `.\.venv\Scripts\python.exe app.py`

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器（端口 5173） |
| `npm run build` | 生产构建 |
| `npm run preview` | 预览构建结果 |

## 相关文档

- 项目总览与 API 列表：仓库根目录 [README.md](../README.md)
- 后端代码与 MQTT 配置：`../backend/app.py`
