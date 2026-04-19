import { useState } from 'react'

type ProjectId = 'voice' | 'furniture' | 'simulation'

const projects: { id: ProjectId; label: string }[] = [
  { id: 'voice', label: '语音控制' },
  { id: 'furniture', label: '智能家具管理' },
  { id: 'simulation', label: '智能家具模拟' },
]

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

function VoiceControlPanel() {
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
    </div>
  )
}

function SmartFurniturePanel() {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-slate-900">智能家具管理</h1>
      <p className="text-slate-600">
        这里可放置家具设备列表、房间分组与状态（示例页面）。
      </p>
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        示例：客厅灯 · 在线；空调 · 26℃
      </div>
    </div>
  )
}

/** 大灯开关：1 开，0 关（静态模拟，后续可换成真实接口） */
type LampPower = 0 | 1

function FurnitureSimulationPanel() {
  const [mainLampPower, setMainLampPower] = useState<LampPower>(0)

  /** 传入 0 / 1 控制大灯（静态：只改本地状态） */
  function applyMainLamp(power: LampPower) {
    setMainLampPower(power)
  }

  const isOn = mainLampPower === 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">智能家具模拟</h1>
        <p className="mt-1 text-slate-600">
          静态演示：通过数值 <code className="rounded bg-slate-100 px-1">0</code> /{' '}
          <code className="rounded bg-slate-100 px-1">1</code> 控制客厅大灯开关。
        </p>
      </div>

      <div
        className={`rounded-xl border p-6 transition-colors ${
          isOn
            ? 'border-amber-200 bg-amber-50/80 shadow-[0_0_40px_rgba(251,191,36,0.35)]'
            : 'border-slate-200 bg-slate-100/80'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-800">客厅 · 大灯</p>
            <p className="text-xs text-slate-500">
              当前指令值：<span className="font-mono text-slate-800">{mainLampPower}</span>（
              {isOn ? '开' : '关'}）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">模拟控制：</span>
            <button
              type="button"
              onClick={() => applyMainLamp(1)}
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
              onClick={() => applyMainLamp(0)}
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

        <div className="mt-4 flex items-center gap-3">
          <div
            className={`flex size-14 items-center justify-center rounded-full transition-all ${
              isOn
                ? 'bg-amber-300 text-amber-950 shadow-[0_0_24px_rgba(252,211,77,0.9)]'
                : 'bg-slate-300 text-slate-600'
            }`}
            aria-hidden
          >
            <svg className="size-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3a6 6 0 0 0-6 6c0 2.22 1.21 4.15 3 5.19V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4.81c1.79-1.04 3-2.97 3-5.19a6 6 0 0 0-6-6zm-1 17h2v1h-2v-1z" />
            </svg>
          </div>
          <p className="text-sm text-slate-600">
            {isOn ? '灯已点亮（静态效果）' : '灯已关闭'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [active, setActive] = useState<ProjectId>('voice')

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
        {active === 'voice' && <VoiceControlPanel />}
        {active === 'furniture' && <SmartFurniturePanel />}
        {active === 'simulation' && <FurnitureSimulationPanel />}
      </main>
    </div>
  )
}
