import { useCallback, useEffect, useRef, useState } from 'react'

type ProjectId = 'voice' | 'furniture' | 'simulation'
type ChatRole = 'user' | 'assistant'
type ChatMessage = { role: ChatRole; content: string }
type SwitchPower = 0 | 1
type CurtainState = 'open' | 'closed'
type DeviceKey = 'light' | 'fan' | 'curtain' | 'tv'
type VoiceAction = 'on' | 'off'
type VoiceCommand = { device: DeviceKey; action: VoiceAction }
type DeviceControlCommand = { device: DeviceKey; action: VoiceAction }
type HomeState = {
  light: SwitchPower
  fan: SwitchPower
  curtain: CurtainState
  tv: SwitchPower
}
type DeviceStateRow = {
  家具?: string
  打开状态?: number
  对应数值?: number
}
const POLL_INTERVAL_MS = 1000

const projects: { id: ProjectId; label: string }[] = [
  { id: 'voice', label: '语音控制' },
  { id: 'furniture', label: '智能家具管理' },
  { id: 'simulation', label: '智能家具模拟' },
]
function VoiceControl({
  onCommand,
  onConversation,
}: {
  onCommand: (command: VoiceCommand) => void
  onConversation: (messages: ChatMessage[]) => void
}) {
  const [loading, setLoading] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = async () => {
    if (loading || recorderRef.current) return
    setLoading(true)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    streamRef.current = stream
    recorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = (a) => chunksRef.current.push(a.data)

    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' })
        const FD = new FormData()
        FD.append('ddc', blob, 'audio.wav')
        const response = await fetch('/api/voice-control', {
          method: 'POST',
          body: FD,
        })

        if (!response.ok) {
          let detail = ''
          try {
            const errData = await response.json()
            detail = errData?.error ? ` - ${errData.error}` : ''
          } catch {
            detail = ''
          }
          throw new Error(`请求失败：${response.status}${detail}`)
        }

        const data = await response.json()
        const isValidDevice =
          data.device === 'light' ||
          data.device === 'fan' ||
          data.device === 'curtain' ||
          data.device === 'tv'
        const isValidAction = data.action === 'on' || data.action === 'off'

        if (isValidDevice && isValidAction) {
          onCommand({ device: data.device, action: data.action })
        }
        onConversation([
          { role: 'user', content: data.transcript ?? '（未识别到文本）' },
          { role: 'assistant', content: data.model_response ?? JSON.stringify(data) },
        ])
      } catch (error) {
        console.error('语音控制请求失败', error)
      } finally {
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        chunksRef.current = []
        setLoading(false)
      }
    }
    recorder.start()
  }

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-md border-2 border-red-500 p-2"
        onClick={start}
        disabled={loading}
      >
        {loading ? '录音中...' : '开始录音'}
      </button>
      <button
        type="button"
        className="rounded-md border border-slate-400 bg-white p-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={stop}
        disabled={!loading}
      >
        停止录音
      </button>
    </div>
  )
}
function SmartHomeLogo() {
  return (
    <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
      <svg
        className="size-9 shrink-0 text-blue-600"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M20 6L8 13v14h6v-8h12v8h6V13L20 6z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M14 28h12v6H14v-6z"
          fill="currentColor"
          fillOpacity="0.2"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M20 4v4M12 10l2 2M28 10l-2 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-sm font-semibold text-slate-800">智能家居</span>
    </div>
  )
}

function VoiceControlPanel({ onCommand }: { onCommand: (command: VoiceCommand) => void }) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  const handleConversation = (messages: ChatMessage[]) => {
    setChatMessages((prev) => [...prev, ...messages])
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-slate-900">语音控制</h1>
      <p className="text-slate-600">
        这里展示语音指令、唤醒词与设备联动等说明（示例页面，可按需接入真实功能）。
      </p>
      <ul className="list-disc pl-5 text-slate-600 space-y-1">
        <li>说出唤醒词后下达指令</li>
        <li>支持开关灯、调节温度等场景</li>
      </ul>
      <VoiceControl onCommand={onCommand} onConversation={handleConversation} />
      <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">对话记录</h2>
        {chatMessages.length === 0 ? (
          <p className="text-sm text-slate-500">暂无对话，录音后会显示在这里。</p>
        ) : (
          <div className="space-y-2">
            {chatMessages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                className={`rounded-md px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-50 text-blue-900'
                    : 'bg-emerald-50 text-emerald-900'
                }`}
              >
                <span className="mr-2 font-medium">{msg.role === 'user' ? '我' : '模型'}</span>
                <span>{msg.content}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SmartFurniturePanel({ homeState }: { homeState: HomeState }) {
  const lampLabel = homeState.light ? '开' : '关'
  const fanLabel = homeState.fan ? '开' : '关'
  const curtainLabel = homeState.curtain === 'open' ? '打开' : '关闭'
  const tvLabel = homeState.tv ? '开' : '关'

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-slate-900">智能家具管理</h1>
      <p className="text-slate-600">
        这里展示语音控制后的家具状态（示例页面）。
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          客厅灯：{lampLabel}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          风扇：{fanLabel}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          窗帘：{curtainLabel}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          电视：{tvLabel}
        </div>
      </div>
    </div>
  )
}

function FurnitureSimulationPanel({
  homeState,
  onDeviceControl,
}: {
  homeState: HomeState
  onDeviceControl: (command: DeviceControlCommand) => Promise<void>
}) {
  function applySwitch(device: 'light' | 'fan' | 'tv', power: SwitchPower) {
    void onDeviceControl({ device, action: power === 1 ? 'on' : 'off' })
  }

  function applyCurtain(state: CurtainState) {
    void onDeviceControl({ device: 'curtain', action: state === 'open' ? 'on' : 'off' })
  }

  const devices: {
    key: 'light' | 'fan' | 'tv'
    label: string
    state: SwitchPower
  }[] = [
    { key: 'light', label: '客厅 · 大灯', state: homeState.light },
    { key: 'fan', label: '客厅 · 风扇', state: homeState.fan },
    { key: 'tv', label: '客厅 · 电视', state: homeState.tv },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">智能家具模拟</h1>
        <p className="mt-1 text-slate-600">
          静态演示：灯光、风扇、电视支持开关，窗帘支持打开/关闭，均可被语音控制。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {devices.map((device) => {
          const isOn = device.state === 1
          return (
            <div
              key={device.key}
              className={`rounded-xl border p-5 transition-colors ${
                isOn
                  ? 'border-amber-200 bg-amber-50/80 shadow-[0_0_28px_rgba(251,191,36,0.25)]'
                  : 'border-slate-200 bg-slate-100/80'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{device.label}</p>
                  <p className="text-xs text-slate-500">
                    当前指令值：<span className="font-mono text-slate-800">{device.state}</span>（
                    {isOn ? '开' : '关'}）
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applySwitch(device.key, 1)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      isOn
                        ? 'bg-amber-400 text-amber-950'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    开 (1)
                  </button>
                  <button
                    type="button"
                    onClick={() => applySwitch(device.key, 0)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      !isOn
                        ? 'bg-slate-600 text-white'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    关 (0)
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-800">客厅 · 窗帘</p>
            <p className="text-xs text-slate-500">
              当前状态：{homeState.curtain === 'open' ? '打开' : '关闭'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyCurtain('open')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                homeState.curtain === 'open'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              打开 (on)
            </button>
            <button
              type="button"
              onClick={() => applyCurtain('closed')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                homeState.curtain === 'closed'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              关闭 (off)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [active, setActive] = useState<ProjectId>('voice')
  const [homeState, setHomeState] = useState<HomeState>({
    light: 0,
    fan: 0,
    curtain: 'closed',
    tv: 0,
  })

  const syncDeviceStates = useCallback(async () => {
    try {
      const response = await fetch('/api/device-states')
      if (!response.ok) return
      const payload = await response.json()
      const rows: DeviceStateRow[] = Array.isArray(payload?.data) ? payload.data : []

      setHomeState((prev) => {
        const next = { ...prev }
        for (const row of rows) {
          const device = row?.家具
          const status = row?.打开状态 === 1 ? 1 : 0
          if (device === 'light') next.light = status
          if (device === 'fan') next.fan = status
          if (device === 'tv') next.tv = status
          if (device === 'curtain') next.curtain = status === 1 ? 'open' : 'closed'
        }
        return next
      })
    } catch (error) {
      console.error('拉取设备状态失败', error)
    }
  }, [])

  const applyLocalCommand = useCallback((command: DeviceControlCommand) => {
    setHomeState((prev) => {
      if (command.device === 'curtain') {
        return { ...prev, curtain: command.action === 'on' ? 'open' : 'closed' }
      }
      const power: SwitchPower = command.action === 'on' ? 1 : 0
      return { ...prev, [command.device]: power }
    })
  }, [])

  useEffect(() => {
    syncDeviceStates()
    const timer = window.setInterval(syncDeviceStates, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [syncDeviceStates])

  const handleVoiceCommand = (command: VoiceCommand) => {
    applyLocalCommand(command)
    void syncDeviceStates()
  }

  const handleDeviceControl = useCallback(
    async (command: DeviceControlCommand) => {
      // 先本地更新，保证按钮点击后 UI 立即反馈
      applyLocalCommand(command)
      try {
        const response = await fetch('/api/device-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(command),
        })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err?.error ?? `请求失败：${response.status}`)
        }
      } catch (error) {
        console.error('设备控制请求失败', error)
      } finally {
        await syncDeviceStates()
        // 某些场景下数据库写入有微小时延，追加一次短延迟同步
        window.setTimeout(() => {
          void syncDeviceStates()
        }, 300)
      }
    },
    [applyLocalCommand, syncDeviceStates],
  )

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
        {/* sticky：右侧内容很长时，左侧栏仍贴在视口顶部 */}
        <div className="sticky top-0 flex h-screen flex-col gap-4 p-4">
          <SmartHomeLogo />
          <nav className="flex flex-col gap-1" aria-label="项目">
            {projects.map((p) => {
              const selected = active === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActive(p.id)}
                  className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? 'font-medium text-blue-600 bg-blue-50'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </nav>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {active === 'voice' && <VoiceControlPanel onCommand={handleVoiceCommand} />}
        {active === 'furniture' && <SmartFurniturePanel homeState={homeState} />}
        {active === 'simulation' && (
          <FurnitureSimulationPanel homeState={homeState} onDeviceControl={handleDeviceControl} />
        )}
      </main>
    </div>
  )
}
