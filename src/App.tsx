import { useState, useEffect, useRef, memo } from "react";
// 引入 Tauri 核心 API
import { invoke } from "@tauri-apps/api/core";
// 引入 窗口控制 API
import { getCurrentWindow } from '@tauri-apps/api/window';
// 引入 图标库
import { Power, Save, Zap, Hash, Sun, Moon, Activity, Palette, Wind, ArrowRight, ArrowLeft, X, Minus } from "lucide-react";

// --- 类型定义 ---
interface ConfigState {
  total_leds: number; active_len: number; effect: number; bright: number;
  breath_en: boolean; breath_freq: number; dir: number; flow_speed: number;
  solid_r: number; solid_g: number; solid_b: number;
  comet_len: number; comet_rainbow: boolean;
}

// --- 组件定义 (必须放在 App 外部！) ---

// 1. 滑块组件 (使用 memo 避免不必要的重渲染)
const Slider = memo(({ value, min, max, onChange }: { value: number, min: number, max: number, onChange: (val: number) => void }) => {
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      // 这里的 onChange 直接传回数值，避免父组件再转换
      onChange={(e) => onChange(Number(e.target.value))}
      // 阻止冒泡，防止无边框窗口的拖动逻辑干扰
      onPointerDown={(e) => e.stopPropagation()}
      className="flex-1 h-5 w-full cursor-pointer"
    />
  );
});

// 2. 行控件
const ControlRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="flex items-center gap-3 text-xs min-h-[24px]">
    <span className="w-8 text-textSub font-medium shrink-0">{label}</span>
    {children}
  </div>
);

// 3. 分组框
const GroupBox = ({ title, icon: Icon, children, className = "" }: any) => (
  <div className={`bg-panel border border-border rounded-3xl p-4 flex flex-col gap-3 shadow-lg backdrop-blur-sm ${className}`}>
    <div className="flex items-center gap-2 mb-1 shrink-0">
      <div className="bg-gradient-to-r from-accentStart to-accentEnd p-1.5 rounded-md text-white shadow-md">
        <Icon size={14} />
      </div>
      <span className="font-bold text-sm text-textMain">{title}</span>
    </div>
    <div className="flex flex-col gap-3 flex-1 justify-center">
      {children}
    </div>
  </div>
);

// 4. 流星参数组件 (提取出来以支持响应式布局复用)
const MeteorControls = ({ config, updateConfig, className = "" }: { config: ConfigState, updateConfig: (k: keyof ConfigState, v: any) => void, className?: string }) => (
  <GroupBox title="流星参数" icon={Activity} className={`flex-1 min-h-[180px] ${className}`}>
    <ControlRow label="尾长">
      <Slider min={1} max={30} value={config.comet_len} onChange={(v) => updateConfig('comet_len', v)} />
      <span className="w-6 text-center text-textMain bg-bgStart rounded py-0.5">{config.comet_len}</span>
    </ControlRow>
    <div className="mt-2 p-2 bg-bgStart/50 rounded-lg border border-border">
      <label className="flex items-center gap-2 cursor-pointer justify-center" onPointerDown={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={config.comet_rainbow} onChange={(e) => updateConfig('comet_rainbow', e.target.checked)} className="accent-accentStart w-4 h-4" />
        <span className={`text-sm transition-colors ${config.comet_rainbow ? 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-green-400 to-blue-400 font-bold' : 'text-textSub'}`}>彩虹尾巴特效</span>
      </label>
    </div>
  </GroupBox>
);

// --- 主程序 ---
function App() {
  // --- 状态管理 ---
  const [ip, setIp] = useState("192.168.1.117");
  const [status, setStatus] = useState("就绪");
  // 主题状态
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  // 初始化和监听主题变化
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const [config, setConfig] = useState<ConfigState>({
    total_leds: 60, active_len: 60, effect: 0, bright: 128,
    breath_en: true, breath_freq: 15, dir: 1, flow_speed: 30,
    solid_r: 255, solid_g: 80, solid_b: 80,
    comet_len: 5, comet_rainbow: false,
  });

  const [pixelId, setPixelId] = useState(0);

  // --- 心跳发送机制 (保持不变，这是正确的网络优化) ---
  const latestConfig = useRef(config);
  const isSending = useRef(false);

  useEffect(() => {
    latestConfig.current = config;
  }, [config]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (isSending.current) return;
      isSending.current = true;
      try {
        const payload = { cmd: "config", ...latestConfig.current };
        await invoke("send_udp", { ip, data: JSON.stringify(payload) });
        setStatus("✓ 同步中...");
      } catch (e) {
        // console.error(e); 
      } finally {
        isSending.current = false;
      }
    }, 100);

    return () => clearInterval(interval);
  }, [ip]);

  // 立即发送指令
  const sendCmdImmediate = async (payload: object) => {
    try {
      await invoke("send_udp", { ip, data: JSON.stringify(payload) });
      setStatus(`✓ 指令已发送`);
    } catch (e) {
      setStatus(`✗ 错误: ${e}`);
    }
  };

  // 更新配置辅助函数
  const updateConfig = (key: keyof ConfigState, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="h-screen flex flex-col p-4 gap-4 font-sans text-xs select-none overflow-hidden">

      {/* Header */}
      <div
        data-tauri-drag-region
        className="bg-panel rounded-xl p-2 md:p-3 flex items-center gap-2 md:gap-4 shadow-md border border-border shrink-0 select-none"
      >
        <div
          className="flex items-center gap-2 bg-bgStart border border-border rounded-lg px-2 py-1 md:px-3 md:py-1.5 transition-colors"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-textSub font-bold">IP</span>
          <input value={ip} onChange={(e) => setIp(e.target.value)}
            className="bg-transparent text-textMain outline-none w-28 font-mono" />
        </div>

        <div className="flex-1 h-full" data-tauri-drag-region />

        <div className="flex gap-2 mr-2" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={toggleTheme}
            className="p-1.5 hover:bg-white/10 rounded-md text-textSub hover:text-textMain transition-colors">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="flex gap-2" onPointerDown={(e) => e.stopPropagation()}>
          {[
            { text: "全开", cmd: "all_on", icon: Zap, grad: "from-successStart to-successEnd" },
            { text: "全关", cmd: "all_off", icon: Power, grad: "from-dangerStart to-dangerEnd" },
            { text: "保存", cmd: "save", icon: Save, grad: "from-accentStart to-accentEnd" }
          ].map((btn, i) => (
            <button key={i} onClick={() => sendCmdImmediate({ cmd: btn.cmd })}
              className={`px-2 py-1 md:px-3 md:py-1.5 bg-gradient-to-r ${btn.grad} rounded-lg text-white font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 md:gap-2 shadow-lg`}>
              <btn.icon size={14} /> <span className="hidden md:inline">{btn.text}</span><span className="md:hidden">{btn.text === "保存" ? "存" : btn.text.replace("全", "")}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 pl-2 md:pl-4 border-l border-border ml-1 md:ml-2" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => getCurrentWindow().minimize()}
            className="p-1.5 hover:bg-white/10 rounded-md text-textSub hover:text-textMain transition-colors">
            <Minus size={16} />
          </button>
          <button onClick={() => getCurrentWindow().close()}
            className="p-1.5 hover:bg-red-500/80 rounded-md text-textSub hover:text-textMain transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 主内容 - 添加 overflow-y-auto 允许移动端滚动 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto pb-4">

        {/* 左列 - 移动端高度自适应，桌面端撑满 */}
        <div className="flex flex-col gap-4 h-auto md:h-full">
          <GroupBox title="全局设置" icon={Sun} className="flex-1 min-h-[200px]">
            <ControlRow label="总数">
              <input type="number" value={config.total_leds} onChange={(e) => updateConfig('total_leds', Number(e.target.value))}
                onPointerDown={(e) => e.stopPropagation()}
                className="bg-bgStart border border-border rounded flex-1 px-3 py-1.5 text-textMain outline-none focus:border-accentStart transition-colors" />
            </ControlRow>
            <ControlRow label="生效">
              <Slider min={1} max={config.total_leds} value={config.active_len} onChange={(v) => updateConfig('active_len', v)} />
              <span className="w-6 text-right text-textSub font-mono">{config.active_len}</span>
            </ControlRow>
            <ControlRow label="亮度">
              <Slider min={0} max={255} value={config.bright} onChange={(v) => updateConfig('bright', v)} />
              <span className="w-6 text-right text-textSub font-mono">{config.bright}</span>
            </ControlRow>
            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer" onPointerDown={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={config.breath_en} onChange={(e) => updateConfig('breath_en', e.target.checked)} className="accent-accentStart w-4 h-4" />
                <span className="text-textSub">呼吸</span>
              </label>
              <Slider min={5} max={60} value={config.breath_freq} onChange={(v) => updateConfig('breath_freq', v)} />
            </div>
          </GroupBox>

          <GroupBox title="特效模式" icon={Wind} className="flex-1 min-h-[180px]">
            <select value={config.effect} onChange={(e) => updateConfig('effect', Number(e.target.value))}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-bgStart text-textMain border border-border rounded px-3 py-2 outline-none w-full mb-2 cursor-pointer hover:border-accentStart transition-colors">
              {["🌈 彩虹 (Rainbow)", "☄️ 流星 (Comet)", "💡 静态 (Static)", "✨ 闪烁 (Blink)", "🎭 跑马灯 (Marquee)"].map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select>
            <div className="flex gap-3 mb-2 bg-bgStart/50 p-1.5 rounded-lg border border-border">
              {[1, -1].map(d => (
                <label key={d} className={`flex-1 flex items-center justify-center gap-2 cursor-pointer py-1.5 rounded-md transition-all ${config.dir === d ? 'bg-accentStart text-white shadow-md' : 'text-textSub hover:bg-white/5'}`} onPointerDown={(e) => e.stopPropagation()}>
                  <input type="radio" name="dir" checked={config.dir === d} onChange={() => updateConfig('dir', d)} className="hidden" />
                  {d === 1 ? <>正向 <ArrowRight size={12} /></> : <><ArrowLeft size={12} /> 反向</>}
                </label>
              ))}
            </div>
            <ControlRow label="速度">
              <Slider min={0} max={100} value={config.flow_speed} onChange={(v) => updateConfig('flow_speed', v)} />
            </ControlRow>
          </GroupBox>

          {/* 流星参数 (仅 Mobile 显示) */}
          <MeteorControls config={config} updateConfig={updateConfig} className="md:hidden" />
        </div>

        {/* 右列 */}
        <div className="flex flex-col gap-4 h-auto md:h-full">
          <GroupBox title="颜色调节" icon={Palette} className="flex-[1.5] min-h-[220px]">
            {['r', 'g', 'b'].map((c) => (
              <ControlRow key={c} label={c.toUpperCase()}>
                <span className={`w-2.5 h-2.5 rounded-full mr-1 shadow-sm ${c === 'r' ? 'bg-red-500' : c === 'g' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                <Slider min={0} max={255} value={(config as any)[`solid_${c}`]} onChange={(v) => updateConfig(`solid_${c}` as any, v)} />
              </ControlRow>
            ))}
            <div className="h-6 rounded-lg border border-border mt-2 shadow-inner transition-colors duration-300"
              style={{ backgroundColor: `rgb(${config.solid_r}, ${config.solid_g}, ${config.solid_b})`, boxShadow: `0 0 20px rgb(${config.solid_r}, ${config.solid_g}, ${config.solid_b}, 0.2)` }} />
          </GroupBox>

          {/* 流星参数 (仅 Desktop 显示 - 恢复原来的位置) */}
          <MeteorControls config={config} updateConfig={updateConfig} className="hidden md:flex" />

          <GroupBox title="单点控制" icon={Hash} className="flex-1 min-h-[100px]">
            <div className="flex gap-3 items-center h-full">
              <input type="number" value={pixelId} onChange={(e) => setPixelId(Number(e.target.value))}
                onPointerDown={(e) => e.stopPropagation()}
                className="bg-[var(--input-bg)] border border-border rounded w-16 text-center text-textMain py-2 outline-none focus:border-accentStart" placeholder="ID" />
              <div className="flex-1 flex gap-2">
                <button onClick={() => sendCmdImmediate({ cmd: "pixel", idx: pixelId, r: config.solid_r, g: config.solid_g, b: config.solid_b })}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex-1 bg-gradient-to-r from-accentStart to-accentEnd rounded-lg text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-accentStart/20">
                  设置当前色
                </button>
                <button onClick={() => sendCmdImmediate({ cmd: "pixel", idx: pixelId, r: 0, g: 0, b: 0 })}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-14 bg-[var(--btn-neutral-bg)] hover:bg-[var(--btn-neutral-hover)] text-[var(--btn-neutral-text)] rounded-lg text-xs font-bold active:scale-95 transition-all">
                  关
                </button>
              </div>
            </div>
          </GroupBox>
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="text-[10px] text-gray-600 text-center font-mono h-4 shrink-0">{status}</div>
    </div>
  );
}

export default App;