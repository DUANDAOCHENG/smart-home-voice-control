# 智能家居语音控制系统

毕业设计：基于大模型的语音控制智能家居系统。

本仓库为单项目根目录，前后端分目录放置：

| 目录 | 说明 |
|------|------|
| `frontend/` | React + Vite + TypeScript + Tailwind 前端 |
| `backend/` | Python + Flask 后端（语音识别、大模型解析、SQLite、MQTT） |

## 环境要求

- **Node.js** 18+（用于前端）
- **Python** 3.10+（用于后端，需能安装 `requirements.txt` 中的依赖）
- 可选：**Mosquitto** MQTT Broker（控制 ESP32 灯/风扇时需本机或局域网 broker 可用）

## 第一次使用

### 前端

```powershell
cd frontend
npm install
```

### 后端

建议使用虚拟环境，避免污染全局 Python：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

若不用虚拟环境，可直接：

```powershell
cd backend
python -m pip install -r requirements.txt
```

> 首次运行会加载 Whisper 等模型，可能较慢；缓存目录默认为 `backend/.cache`。

## 启动项目（开发环境）

需要**多个终端**，按顺序启动。控制 ESP32 灯/风扇时，需先启 MQTT Broker，再启后端和前端。

| 顺序 | 服务 | 默认地址 |
|------|------|----------|
| 1 | MQTT Broker（Mosquitto） | `0.0.0.0:1883` |
| 2 | 后端 Flask | http://127.0.0.1:3000 |
| 3 | 前端 Vite | http://127.0.0.1:5173 |
| 4 | ESP32 固件 | 订阅 `smart_home/light/state`、`smart_home/fan/state` |

### 0. 启动 MQTT Broker（控制硬件时需要）

项目配置文件：`backend/mosquitto.conf`。密码文件因 Mosquitto 无法读取中文路径，实际使用 `C:\mosquitto_data\mosquitto_passwd.txt`。

**首次使用**需创建 `ddc` 用户（与 `app.py`、`esp32.py` 中的账号一致）：

```powershell
New-Item -ItemType Directory -Force -Path "C:\mosquitto_data"
Copy-Item "D:\Project\毕业设计\backend\mosquitto_passwd.txt" "C:\mosquitto_data\mosquitto_passwd.txt" -Force
& "C:\Program Files\mosquitto\mosquitto_passwd.exe" -b "C:\mosquitto_data\mosquitto_passwd.txt" ddc "Ddc@2026mqtt!"
```

**启动 Broker**（保持该终端窗口不要关闭）：

```powershell
& "C:\Program Files\mosquitto\mosquitto.exe" -v -c "D:\Project\毕业设计\backend\mosquitto.conf"
```

验证是否启动成功：

```powershell
netstat -ano | findstr ":1883"
```

应看到 `0.0.0.0:1883` 处于 `LISTENING` 状态。

可选：用本机测试发布/订阅（账号 `ddc`，密码 `Ddc@2026mqtt!`）：

```powershell
# 终端 A：订阅
& "C:\Program Files\mosquitto\mosquitto_sub.exe" -h 127.0.0.1 -p 1883 -u ddc -P "Ddc@2026mqtt!" -t smart_home/light/state -v

# 终端 B：发布
& "C:\Program Files\mosquitto\mosquitto_pub.exe" -h 127.0.0.1 -p 1883 -u ddc -P "Ddc@2026mqtt!" -t smart_home/light/state -m "{\"value\":1}"
```

**ESP32 连接参数**（`backend/esp32.py`）需与电脑在同一局域网，Broker 地址填电脑 IPv4（如 `192.168.0.3`）：

| 参数 | 值 |
|------|-----|
| `MQTT_BROKER` | 电脑局域网 IP（如 `192.168.0.3`） |
| `MQTT_PORT` | `1883` |
| `MQTT_USER` / `MQTT_PASS` | `ddc` / `Ddc@2026mqtt!` |

查看本机 IP：

```powershell
ipconfig | findstr /R /C:"IPv4"
```

### 1. 启动后端（默认端口 3000）

```powershell
cd backend
.\.venv\Scripts\Activate.ps1   # 若使用了虚拟环境
python app.py
```

成功后在浏览器访问应返回 JSON：

- `http://127.0.0.1:3000/api/device-states`

### 2. 启动前端（默认端口 5173）

**在后端已监听 3000 端口后，新开一个终端**：

```powershell
cd frontend
npm run dev
```

浏览器打开终端提示的地址，一般为：

- **前端页面**：<http://127.0.0.1:5173>
- **经代理访问 API**：<http://127.0.0.1:5173/api/device-states>

### 端口被占用时

若 **3000** 已被其他程序占用，可在**两个终端都**设置同一端口后再启动（示例改为 **3001**）：

```powershell
$env:SMART_HOME_PORT = '3001'
```

- 后端：`python app.py` 会监听 `3001`
- 前端：`npm run dev` 时 Vite 会把 `/api` 代理到 `http://127.0.0.1:3001`

未设置 `SMART_HOME_PORT` 时，后端与代理均使用 **3000**。

### Windows PowerShell 5.1 注意

- 不支持 `&&` 链式命令，请分多行执行，或使用 `;` 分隔。
- 路径含中文时，可用：`Set-Location -LiteralPath 'd:\Project\毕业设计\backend'`
- 若 `python` 指向应用商店占位程序，请使用完整路径，例如：  
  `& 'C:\Users\你的用户名\AppData\Local\Programs\Python\Python313\python.exe' app.py`

## 常用 API（后端）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/device-states` | 查询各设备状态 |
| POST | `/api/device-control` | 手动控制设备 |
| POST | `/api/voice-control` | 上传语音并解析控制指令 |
| POST | `/api/mqtt/sync-light` | 将数据库中灯状态同步到 MQTT |
| POST | `/api/mqtt/sync-fan` | 将数据库中风扇状态同步到 MQTT |

## 目录说明

- 若根目录仍残留旧的 `node_modules`，请先关闭占用该目录的进程（如正在运行的 `npm run dev`），再删除；依赖请分别在 `frontend` 与 `backend` 下安装。
- 设备状态数据库：`backend/smart_home.db`
- MQTT 配置文件：`backend/mosquitto.conf`
- MQTT 密码文件（项目内备份）：`backend/mosquitto_passwd.txt`；Broker 实际读取：`C:\mosquitto_data\mosquitto_passwd.txt`
- ESP32 固件脚本：`backend/esp32.py`
- MQTT 相关环境变量（可选）：`MQTT_HOST`、`MQTT_PORT`、`MQTT_USERNAME`、`MQTT_PASSWORD`、`MQTT_TOPIC_PREFIX`
