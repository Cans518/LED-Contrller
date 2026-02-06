/**
 * LED Controller - Main Application Component
 * 
 * A Tauri + React application for controlling WS2812 LED strips via ESP32 WiFi.
 * Features: Real-time control, multiple effects, Light/Dark theme with persistence.
 * 
 * @author LED Controller Team
 * @license MIT
 */

import { useState, useEffect, useRef, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Power, Save, Zap, Hash, Sun, Moon, Activity, Palette, Wind, ArrowRight, ArrowLeft, X, Minus, Link as LinkIcon, Link2Off, Wifi, Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";

// --- 类型定义 ---
interface ConfigState {
  total_leds: number; active_len: number; effect: number; bright: number;
  breath_en: boolean; breath_freq: number; dir: number; flow_speed: number;
  solid_r: number; solid_g: number; solid_b: number;
  comet_len: number; comet_rainbow: boolean;
  wifi?: { ssid: string; pass: string }[];
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
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerDown={(e) => e.stopPropagation()}
      // 移动端增大触摸区域
      className="flex-1 h-8 md:h-5 w-full cursor-pointer touch-none"
    />
  );
});

// 2. 行控件 (移动端增大触摸区域)
const ControlRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="flex items-center gap-2 md:gap-3 text-xs min-h-[36px] md:min-h-[24px]">
    <span className="w-8 text-textSub font-medium shrink-0">{label}</span>
    {children}
  </div>
);

// 3. 分组框 (移动端优化 padding 和圆角)
const GroupBox = ({ title, icon: Icon, children, className = "" }: any) => (
  <div className={`bg-panel border border-border rounded-2xl md:rounded-3xl p-3 md:p-4 flex flex-col gap-2 md:gap-3 shadow-lg backdrop-blur-sm ${className}`}>
    <div className="flex items-center gap-2 shrink-0">
      <div className="bg-gradient-to-r from-accentStart to-accentEnd p-1.5 md:p-1.5 rounded-lg md:rounded-md text-white shadow-md">
        <Icon size={14} />
      </div>
      <span className="font-bold text-sm text-textMain">{title}</span>
    </div>
    <div className="flex flex-col gap-2 md:gap-3 flex-1 justify-center">
      {children}
    </div>
  </div>
);

// 4. 流星参数组件 (提取出来以支持响应式布局复用)
const MeteorControls = ({ config, updateConfig, className = "" }: { config: ConfigState, updateConfig: (k: keyof ConfigState, v: any) => void, className?: string }) => (
  <GroupBox title="流星参数" icon={Activity} className={className}>
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

// 5. WiFi 管理组件 (美化版 - 双模加强)
const WiFiManager = ({ config, updateConfig, onClose, onSave, theme }: { config: ConfigState, updateConfig: (k: keyof ConfigState, v: any) => void, onClose: () => void, onSave: () => void, theme: string }) => {
  const networks = config.wifi || [];
  const isLight = theme === 'light';

  // 根据主题动态设置样式
  const styles = {
    overlay: isLight ? "bg-black/20 backdrop-blur-sm" : "bg-black/60 backdrop-blur-md", // 浅色遮罩更淡
    panel: isLight ? "bg-white/90 backdrop-blur-xl border-white/40 shadow-xl ring-1 ring-black/5" : "bg-panel border-white/10 ring-1 ring-white/5", // 浅色面板更通透
    headerBg: isLight ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-gray-100" : "bg-gradient-to-r from-bgStart to-bgEnd border-border",
    headerIconBox: isLight ? "bg-blue-500 shadow-blue-200" : "bg-gradient-to-r from-accentStart to-accentEnd shadow-accentStart/20",
    headerTitle: isLight ? "text-gray-800" : "text-white",
    headerSub: isLight ? "text-gray-500" : "text-textSub",
    listEmpty: isLight ? "border-gray-200 bg-gray-50 text-gray-500" : "border-white/5 bg-white/5 text-textSub",
    listItem: isLight ? "bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200" : "bg-white/5 hover:bg-white/[0.08] border-white/5 hover:shadow-md",
    inputBox: isLight ? "bg-gray-50 border-gray-100 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100" : "bg-black/20 border-transparent focus-within:border-accentStart/50",
    inputLabel: isLight ? "border-gray-200 bg-gray-100 text-gray-600" : "border-white/5 bg-black/5 text-textSub",
    inputText: isLight ? "text-gray-900 placeholder-gray-400" : "text-textMain placeholder-textSub/30",
    addButton: isLight ? "border-gray-300 bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-600 hover:text-blue-600" : "border-white/10 hover:border-accentStart/50 hover:bg-accentStart/5 text-textSub hover:text-white",
    addButtonIcon: isLight ? "bg-gray-100 text-gray-500 group-hover:bg-blue-500 group-hover:text-white" : "bg-white/10 group-hover:bg-accentStart text-white",
    footer: isLight ? "bg-gray-50/80 border-gray-100" : "bg-black/20 border-white/5",
    btnCancel: isLight ? "text-gray-600 hover:bg-gray-200 hover:text-gray-900" : "text-textSub hover:bg-white/5 hover:text-white",
    btnSave: isLight ? "bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300" : "bg-gradient-to-r from-accentStart to-accentEnd text-white shadow-accentStart/25 hover:shadow-accentStart/40"
  };

  const updateNetwork = (index: number, field: 'ssid' | 'pass', value: string) => {
    const newNetworks = [...networks];
    newNetworks[index] = { ...newNetworks[index], [field]: value };
    updateConfig('wifi', newNetworks);
  };

  const addNetwork = () => {
    updateConfig('wifi', [...networks, { ssid: "", pass: "" }]);
  };

  const removeNetwork = (index: number) => {
    if (confirm('确定删除此网络配置吗?')) {
      const newNetworks = networks.filter((_, i) => i !== index);
      updateConfig('wifi', newNetworks);
    }
  };

  const moveNetwork = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= networks.length) return;
    const newNetworks = [...networks];
    const temp = newNetworks[index];
    newNetworks[index] = newNetworks[index + direction];
    newNetworks[index + direction] = temp;
    updateConfig('wifi', newNetworks);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300 ${styles.overlay}`}>
      <div className={`w-full max-w-md rounded-3xl shadow-2xl border flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300 ${styles.panel}`}>
        {/* Header */}
        <div className={`relative p-6 border-b overflow-hidden ${styles.headerBg}`}>
          {!isLight && <div className="absolute inset-0 bg-gradient-to-r from-accentStart/10 to-accentEnd/10"></div>}
          <div className="relative flex justify-between items-center z-10">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl shadow-lg flex items-center justify-center text-white ${styles.headerIconBox}`}>
                <Wifi size={24} />
              </div>
              <div>
                <h2 className={`font-bold text-xl tracking-tight ${styles.headerTitle}`}>WiFi Settings</h2>
                <p className={`text-xs ${styles.headerSub}`}>Manage device connectivity</p>
              </div>
            </div>
            <button onClick={onClose} className={`p-2 rounded-full transition-all active:scale-90 ${isLight ? 'text-gray-400 hover:bg-black/5 hover:text-gray-700' : 'hover:bg-white/10 text-textSub hover:text-white'}`}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 gap-4 flex flex-col custom-scrollbar">
          {networks.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-12 gap-3 border-2 border-dashed rounded-2xl ${styles.listEmpty}`}>
              <Wifi size={48} className="opacity-20" />
              <div className="text-sm font-medium">No Networks Configured</div>
              <button onClick={addNetwork} className={`px-4 py-2 rounded-lg text-xs transition-colors border ${isLight ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                Add your first network
              </button>
            </div>
          ) : (
            networks.map((net, i) => (
              <div key={i} className={`p-4 rounded-2xl border flex flex-col gap-3 transition-all group animate-in slide-in-from-bottom-2 duration-300 ${styles.listItem}`} style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-3">
                    <div className={`flex items-center gap-2 rounded-xl pr-1 border transition-all duration-200 ${styles.inputBox}`}>
                      <span className={`text-xs font-bold px-3 py-2.5 border-r rounded-l-xl w-16 text-center shadow-sm ${styles.inputLabel}`}>SSID</span>
                      <input type="text" value={net.ssid} onChange={(e) => updateNetwork(i, 'ssid', e.target.value)}
                        className={`flex-1 bg-transparent py-2 px-2 text-sm outline-none font-medium ${styles.inputText}`} placeholder="Network Name" />
                    </div>
                    <div className={`flex items-center gap-2 rounded-xl pr-1 border transition-all duration-200 ${styles.inputBox}`}>
                      <span className={`text-xs font-bold px-3 py-2.5 border-r rounded-l-xl w-16 text-center shadow-sm ${styles.inputLabel}`}>PWD</span>
                      <input type="text" value={net.pass} onChange={(e) => updateNetwork(i, 'pass', e.target.value)}
                        className={`flex-1 bg-transparent py-2 px-2 text-sm outline-none font-mono ${styles.inputText}`} placeholder="Password" />
                    </div>
                  </div>

                  <div className={`flex flex-col gap-1 self-stretch justify-center pl-2 border-l ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveNetwork(i, -1)} disabled={i === 0}
                        className={`p-1.5 rounded-lg transition-colors ${isLight ? 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:text-gray-200' : 'text-textSub hover:text-white disabled:opacity-30 hover:bg-white/10'}`}>
                        <ArrowUp size={16} />
                      </button>
                      <button onClick={() => moveNetwork(i, 1)} disabled={i === networks.length - 1}
                        className={`p-1.5 rounded-lg transition-colors ${isLight ? 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:text-gray-200' : 'text-textSub hover:text-white disabled:opacity-30 hover:bg-white/10'}`}>
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`flex justify-end border-t pt-2 ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                  <button onClick={() => removeNetwork(i)} className="flex items-center gap-1.5 px-3 py-1.5 text-red-400/80 hover:text-red-500 hover:bg-red-500/10 rounded-lg text-xs font-medium transition-all ml-auto">
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            ))
          )}

          <button onClick={addNetwork} className={`mt-2 py-4 border border-dashed rounded-2xl transition-all flex items-center justify-center gap-2 group ${styles.addButton}`}>
            <div className={`p-1.5 rounded-full transition-colors border ${isLight ? 'border-gray-200' : 'border-white/10'} ${styles.addButtonIcon}`}>
              <Plus size={16} />
            </div>
            <span className="font-medium">Add Another Network</span>
          </button>
        </div>

        {/* Footer */}
        <div className={`p-5 border-t backdrop-blur-sm flex gap-4 ${styles.footer}`}>
          <button onClick={onClose} className={`flex-1 py-3 rounded-xl font-bold transition-colors border border-transparent ${styles.btnCancel}`}>
            Cancel
          </button>
          <button onClick={onSave} className={`flex-[2] py-3 rounded-xl font-bold shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 ${styles.btnSave}`}>
            <Save size={18} />
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};

// 6. 设备扫描弹窗 (雷达效果)
interface Device {
  ip: string;
  mac: string;
}

const DiscoveryModal = ({ onClose, onSelect, theme }: { onClose: () => void, onSelect: (ip: string) => void, theme: string }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(true);
  const [confirmDevice, setConfirmDevice] = useState<Device | null>(null); // State for confirmation
  const isLight = theme === 'light';

  useEffect(() => {
    let mounted = true;
    const scan = async () => {
      try {
        const found = await invoke<Device[]>("scan_devices");
        if (mounted) {
          // Deduplicate by IP
          const unique = found.filter((dev, index, self) =>
            index === self.findIndex((t) => t.ip === dev.ip)
          );
          setDevices(unique);
          setScanning(false);
        }
      } catch (e) {
        console.error(e);
        if (mounted) setScanning(false);
      }
    };
    scan();
    return () => { mounted = false; };
  }, []);

  const styles = {
    overlay: isLight ? "bg-black/20 backdrop-blur-sm" : "bg-black/80 backdrop-blur-md",
    panel: isLight ? "bg-white/90 border-white/40 shadow-xl ring-1 ring-black/5" : "bg-panel border-white/10 ring-1 ring-white/5",
    textMain: isLight ? "text-gray-800" : "text-white",
    textSub: isLight ? "text-gray-500" : "text-textSub",
    item: isLight ? "bg-gray-50 hover:bg-blue-50 border-gray-200 text-gray-700 hover:text-blue-700" : "bg-white/5 hover:bg-white/10 border-white/5 text-textMain",
    ripple: isLight ? "border-blue-500/30" : "border-accentStart/30"
  };

  if (confirmDevice) {
    return (
      <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300 ${styles.overlay}`}>
        <div className={`w-full max-w-sm rounded-3xl shadow-2xl border flex flex-col p-6 items-center gap-4 animate-in zoom-in-95 duration-300 ${styles.panel}`}>
          <div className={`p-4 rounded-full ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-white/10 text-white'}`}>
            <Wifi size={32} />
          </div>
          <div className="text-center space-y-2">
            <h3 className={`font-bold text-lg ${styles.textMain}`}>Connect to Device?</h3>
            <div className={`text-sm font-mono ${styles.textSub} bg-black/5 p-2 rounded-lg`}>
              <div className="font-bold text-base">{confirmDevice.ip}</div>
              <div className="text-xs opacity-70">{confirmDevice.mac}</div>
            </div>
          </div>
          <div className="flex w-full gap-3 mt-2">
            <button onClick={() => setConfirmDevice(null)}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
              Cancel
            </button>
            <button onClick={() => onSelect(confirmDevice.ip)}
              className={`flex-1 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 ${isLight ? 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700' : 'bg-gradient-to-r from-accentStart to-accentEnd text-white shadow-accentStart/25'}`}>
              Connect
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300 ${styles.overlay}`}>
      <div className={`w-full max-w-sm rounded-3xl shadow-2xl border flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 p-6 items-center gap-6 ${styles.panel}`}>

        {/* Radar Animation */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          {scanning && (
            <>
              <div className={`absolute inset-0 rounded-full border-2 animate-[ping_2s_linear_infinite] ${styles.ripple}`}></div>
              <div className={`absolute inset-4 rounded-full border-2 animate-[ping_2s_linear_infinite] delay-500 ${styles.ripple}`}></div>
            </>
          )}
          <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg relative z-10 ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-gradient-to-br from-accentStart to-accentEnd text-white'}`}>
            <Wifi size={32} className={scanning ? "animate-pulse" : ""} />
          </div>
        </div>

        <div className="text-center space-y-1">
          <h3 className={`font-bold text-lg ${styles.textMain}`}>{scanning ? "Scanning..." : "Scan Complete"}</h3>
          <p className={`text-xs ${styles.textSub}`}>Looking for devices on local network</p>
        </div>

        {/* Device List */}
        <div className="w-full flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">
          {devices.length === 0 && !scanning ? (
            <div className={`text-center py-4 text-xs ${styles.textSub}`}>No devices found.</div>
          ) : (
            devices.map((dev, i) => (
              <button key={i} onClick={() => setConfirmDevice(dev)}
                className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all group ${styles.item}`}>
                <div className="flex flex-col items-start gap-1">
                  <span className="font-mono font-bold text-sm text-left">{dev.ip}</span>
                  <span className="font-mono text-[10px] opacity-60 text-left">{dev.mac}</span>
                </div>
                <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))
          )}
        </div>

        <button onClick={onClose} className={`py-2 px-6 rounded-full text-sm font-medium transition-colors ${isLight ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
          Cancel
        </button>
      </div>
    </div>
  );
};

// --- 主程序 ---
function App() {
  // --- 状态管理 ---
  const [ip, setIp] = useState("192.168.1.117");
  const [status, setStatus] = useState("未连接");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showWifi, setShowWifi] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false); // New state for discovery modal
  const longPressTimer = useRef<number | null>(null);
  // IP Press Timer
  const ipPressTimer = useRef<number | null>(null);

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
      if (isSending.current || !isConnected) return;
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
  }, [ip, isConnected]);

  // 连接设备
  const handleConnect = async (targetIp?: string) => {
    const activeIp = targetIp || ip;

    if (isConnected && !targetIp) {
      setIsConnected(false);
      setStatus("已断开");
      return;
    }

    setIsConnecting(true);
    setStatus("连接中...");
    try {
      const res: string = await invoke("send_and_receive_udp", { ip: activeIp, data: JSON.stringify({ cmd: "get_config" }) });
      console.log("Config received:", res);
      const newConfig = JSON.parse(res);

      // 过滤掉 config 中不属于 ConfigState 的字段 (简单的做一下合并即可)
      setConfig(prev => ({ ...prev, ...newConfig }));

      setIsConnected(true);
      setStatus("✓ 已连接");
    } catch (e) {
      console.error(e);
      setStatus(`✗ 连接失败: ${e}`);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  // 当 IP 改变时，断开连接
  useEffect(() => {
    if (isConnected) {
      setIsConnected(false);
      setStatus("IP已变更，请重新连接");
    }
  }, [ip]);

  // 长按/点击处理
  const handlePressStart = () => {
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      if (isConnected) {
        setShowWifi(true);
      } else {
        setStatus("请先连接设备以配置 WiFi");
      }
    }, 800); // 800ms 长按触发
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      handleConnect(); // 如果没有触发长按，则执行点击连接
    }
  };

  const handleIpPressStart = () => {
    ipPressTimer.current = window.setTimeout(() => {
      ipPressTimer.current = null;
      setShowDiscovery(true);
    }, 800);
  };

  const handleIpPressEnd = () => {
    if (ipPressTimer.current) {
      clearTimeout(ipPressTimer.current);
      ipPressTimer.current = null;
    }
  };

  // 保存 WiFi 配置
  const handleSaveWifi = async () => {
    if (!config.wifi) return;
    try {
      // 1. 发送配置更新 (带 wifi 数组)
      await sendCmdImmediate({ cmd: "config", wifi: config.wifi });
      // 2. 发送保存命令
      await sendCmdImmediate({ cmd: "save" });
      setStatus("✓ WiFi 配置已保存");
      setShowWifi(false);
    } catch (e) {
      setStatus(`✗ 保存失败: ${e}`);
    }
  };

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
    <div className="h-screen flex flex-col p-3 md:p-4 gap-3 md:gap-4 font-sans text-xs select-none overflow-hidden">

      {/* Header - 移动端更紧凑 */}
      <div
        data-tauri-drag-region
        className="bg-panel rounded-xl p-1.5 md:p-3 flex items-center gap-1.5 md:gap-4 shadow-md border border-border shrink-0 select-none"
      >
        <div
          className="flex items-center gap-2 bg-bgStart border border-border rounded-lg px-2 py-1 md:px-3 md:py-1.5 transition-colors active:scale-95 duration-200"
          onPointerDown={(e) => { e.stopPropagation(); handleIpPressStart(); }}
          onPointerUp={handleIpPressEnd}
          onPointerLeave={handleIpPressEnd}
        >
          <span className="text-textSub font-bold select-none">IP</span>
          <input value={ip} onChange={(e) => setIp(e.target.value)}
            className="bg-transparent text-textMain outline-none w-28 font-mono" />
        </div>

        <button
          onPointerDown={handlePressStart}
          onPointerUp={handlePressEnd}
          onPointerLeave={() => {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          }}
          disabled={isConnecting}
          className={`p-1.5 md:p-1.5 rounded-lg md:rounded-md transition-colors flex items-center gap-1 ${isConnected
            ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
            : 'bg-bgStart text-textSub hover:text-textMain hover:bg-white/10'
            }`}
        >
          {isConnecting ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isConnected ? (
            <LinkIcon size={18} />
          ) : (
            <Link2Off size={18} />
          )}
        </button>

        <div className="flex-1 h-full" data-tauri-drag-region />

        <div className="flex gap-1 md:gap-2 mr-1 md:mr-2" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={toggleTheme}
            className="p-1.5 md:p-1.5 hover:bg-white/10 rounded-lg md:rounded-md text-textSub hover:text-textMain transition-colors">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="flex gap-1.5 md:gap-2" onPointerDown={(e) => e.stopPropagation()}>
          {[
            { text: "全开", cmd: "all_on", icon: Zap, grad: "from-successStart to-successEnd" },
            { text: "全关", cmd: "all_off", icon: Power, grad: "from-dangerStart to-dangerEnd" },
            { text: "保存", cmd: "save", icon: Save, grad: "from-accentStart to-accentEnd" }
          ].map((btn, i) => (
            <button key={i} onClick={() => sendCmdImmediate({ cmd: btn.cmd })}
              className={`p-2 md:px-3 md:py-1.5 bg-gradient-to-r ${btn.grad} rounded-lg text-white font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-lg text-xs`}>
              <btn.icon size={14} />
              <span className="hidden md:inline">{btn.text}</span>
            </button>
          ))}
        </div>

        {/* 窗口控制按钮 - 仅桌面端显示 */}
        <div className="hidden md:flex gap-2 pl-2 md:pl-4 border-l border-border ml-1 md:ml-2" onPointerDown={(e) => e.stopPropagation()}>
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

      {/* 主内容 - Grid 布局，桌面端两列等高 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 flex-1 min-h-0 overflow-y-auto pb-4 items-start md:items-stretch">

        {/* 左列 - 桌面端等高 */}
        <div className="flex flex-col gap-3 md:gap-4 md:flex-1">
          <GroupBox title="全局设置" icon={Sun}>
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

          <GroupBox title="特效模式" icon={Wind} className="md:flex-1">
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

        {/* 右列 - 桌面端等高 */}
        <div className="flex flex-col gap-3 md:gap-4 md:flex-1">
          <GroupBox title="颜色调节" icon={Palette}>
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

          <GroupBox title="单点控制" icon={Hash} className="md:flex-1">
            <div className="flex gap-2 items-center">
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

      {/* WiFi 管理弹窗 */}
      {showWifi && (
        <WiFiManager
          config={config}
          updateConfig={updateConfig}
          onClose={() => setShowWifi(false)}
          onSave={handleSaveWifi}
          theme={theme}
        />
      )}

      {/* 设备扫描弹窗 */}
      {showDiscovery && (
        <DiscoveryModal
          onClose={() => setShowDiscovery(false)}
          onSelect={(selectedIp) => {
            setIp(selectedIp);
            setShowDiscovery(false);
            handleConnect(selectedIp);
          }}
          theme={theme}
        />
      )}

      {/* 底部状态栏 */}
      <div className="text-[10px] text-gray-600 text-center font-mono h-4 shrink-0">{status}</div>
    </div >
  );
}

export default App;