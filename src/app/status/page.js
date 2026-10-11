'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Activity, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function StatusPage() {
  const { t, lang } = useLanguage();
  const [theme, setTheme] = useState('dark');
  const [statusData, setStatusData] = useState(null);
  const [timeframe, setTimeframe] = useState('90d');
  const [lastChecked, setLastChecked] = useState('--:--:--');
  const [clientLatency, setClientLatency] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);
    if (saved === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    if (next === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const fetchStatus = async () => {
    const start = Date.now();
    try {
      const res = await fetch('/api/status?t=' + Date.now());
      const lat = Date.now() - start;
      setClientLatency(lat);
      if (res.ok) {
        const d = await res.json();
        setStatusData(d);
        setLastChecked(new Date().toLocaleTimeString());
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const monitors = statusData?.monitors || {};
  const models = statusData?.backend?.models || {};
  const isAllOperational = statusData?.system === 'operational';

  const monitorOrder = [
    { key: 'frontend', name: 'Frontend Web App (UI)', tag: '/ (Client App)' },
    { key: 'api', name: 'REST API & Web Gateway', tag: '/ping & /api/upload' },
    { key: 'ben2', name: 'BEN2 SOTA Engine', tag: 'ben2.onnx' },
    { key: 'silueta', name: 'Silueta Ultra-Fast Engine', tag: 'silueta.onnx' },
    { key: 'u2netp', name: 'U²-NetP Compact Engine', tag: 'u2netp.onnx' },
    { key: 'isnet', name: 'IS-Net (DIS) Engine', tag: 'isnet.onnx' },
    { key: 'rmbg', name: 'BRIA RMBG-1.4 Engine', tag: 'briarmbg.onnx' },
  ];

  return (
    <>
      <Navbar theme={theme} toggleTheme={toggleTheme} />

      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 flex-1">
        {/* Overall Status Banner */}
        <div
          className={`w-full rounded-2xl p-6 mb-8 shadow-sm flex items-center justify-between transition-colors duration-300 ${
            isAllOperational ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
            </span>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">
                {isAllOperational ? t.status.allOperational : t.status.degraded}
              </h1>
              <p className="text-xs opacity-90 mt-0.5">
                {isAllOperational
                  ? t.status.allOperationalDesc
                  : t.status.degradedDesc}
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[11px] opacity-75 font-mono">{t.status.lastChecked}</div>
            <div className="text-xs font-semibold font-mono">{lastChecked}</div>
          </div>
        </div>

        {/* Component Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Gateway Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <h2 className="text-xs font-bold text-slate-900 dark:text-white">{t.status.gatewayTitle}</h2>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  {t.status.online}
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500">{t.status.endpoint}</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">/ping</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500">{t.status.latency}</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{clientLatency} ms</span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px]">
              <span className="text-slate-400 dark:text-slate-500">{t.status.role}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{t.status.roleVal}</span>
            </div>
          </div>

          {/* Model Cards */}
          {Object.entries(models).map(([key, item]) => {
            const isOp = item.loaded || item.status === 'operational';
            return (
              <div
                key={key}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isOp ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`}></span>
                      <h2 className="text-xs font-bold text-slate-900 dark:text-white">{item.name || key.toUpperCase()}</h2>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        isOp
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {isOp ? t.status.active : t.status.offline}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 dark:text-slate-500">{t.status.weightFile}</span>
                      <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate max-w-[120px]" title={item.file}>
                        {item.file}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 dark:text-slate-500">{t.status.inferenceState}</span>
                      <span className={`font-mono font-semibold ${isOp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isOp ? t.status.preloaded : t.status.notLoaded}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px]">
                  <span className="text-slate-400 dark:text-slate-500">{t.status.runtime}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">ONNX CPU</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Multi-Service Heartbeat Monitor (Uptime Kuma Style Bar Lilin) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {timeframe === '90d'
                  ? t.status.timeline90dTitle
                  : timeframe === '30m'
                  ? t.status.timeline30mTitle
                  : t.status.timeline60sTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {timeframe === '90d'
                  ? t.status.timeline90dDesc
                  : timeframe === '30m'
                  ? t.status.timeline30mDesc
                  : t.status.timeline60sDesc}
              </p>
            </div>

            {/* Timeframe Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <button
                onClick={() => setTimeframe('90d')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  timeframe === '90d'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                {t.status.tab90d}
              </button>
              <button
                onClick={() => setTimeframe('30m')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  timeframe === '30m'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                {t.status.tab30m}
              </button>
              <button
                onClick={() => setTimeframe('1m')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  timeframe === '1m'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                {t.status.tab60s}
              </button>
            </div>
          </div>

          {/* List of Monitors with Candle Bars */}
          <div className="space-y-6">
            {monitorOrder.map(({ key, name, tag }) => {
              const mon = monitors[key];
              const history = mon?.history || {};
              const isOp = mon?.status === 'operational';

              // Select data list based on timeframe
              let list = [];
              if (timeframe === '90d') list = history.h90d || [];
              else if (timeframe === '30m') list = history.h30m || [];
              else if (timeframe === '1m') list = history.h1m || [];

              // If list is empty, synthesize placeholder bars so candles always render
              const barCount = timeframe === '90d' ? 90 : timeframe === '30m' ? 30 : 60;
              const displayBars = [];

              if (list.length > 0) {
                for (let i = 0; i < list.length; i++) {
                  displayBars.push(list[i]);
                }
              } else {
                for (let i = 0; i < barCount; i++) {
                  displayBars.push({ timestamp: Date.now() - (barCount - i) * 60000, healthy: isOp, latency: 12 });
                }
              }

              let upCount = 0;
              let recordedCount = 0;
              let latestLatency = clientLatency || 8;

              displayBars.forEach((item, idx) => {
                const isToday = idx === displayBars.length - 1;
                let h = item.healthy;
                if (isToday && h === null) h = isOp;

                if (h === true) {
                  upCount++;
                  recordedCount++;
                  if (item.latency) latestLatency = item.latency;
                } else if (h === false) {
                  recordedCount++;
                  if (item.latency) latestLatency = item.latency;
                }
              });

              const uptimePct = recordedCount > 0 ? ((upCount / recordedCount) * 100).toFixed(2) + '%' : isOp ? '100.00%' : '0.00%';

              return (
                <div key={key} className="p-4 bg-slate-50/80 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isOp ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`}></span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{tag}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono text-slate-500 dark:text-slate-400">{isOp ? `${latestLatency} ms` : 'Offline'}</span>
                      <span className={`font-bold font-mono ${isOp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {uptimePct}
                      </span>
                    </div>
                  </div>

                  {/* Candle Bars Container */}
                  <div className="flex items-end gap-[2px] sm:gap-[3px] h-9 w-full py-1 bg-white dark:bg-slate-900 rounded-lg px-2 border border-slate-200/60 dark:border-slate-800 overflow-x-hidden">
                    {displayBars.map((item, idx) => {
                      const isLast = idx === displayBars.length - 1;
                      let h = item.healthy;
                      if (isLast && h === null) h = isOp;

                      let colorClass = 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700';
                      let height = 'h-5';
                      let titleText = 'No data';

                      if (timeframe === '90d') {
                        const dStr = new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        if (h === true) {
                          colorClass = 'bg-emerald-500 hover:bg-emerald-400';
                          height = 'h-7';
                          titleText = `${dStr} • Operational (${item.latency || latestLatency}ms)`;
                        } else if (h === false) {
                          colorClass = 'bg-rose-500 hover:bg-rose-400';
                          height = 'h-8';
                          titleText = `${dStr} • Downtime`;
                        } else {
                          titleText = `${dStr} • No data`;
                        }
                      } else {
                        const tStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        if (h === true) {
                          colorClass = 'bg-emerald-500 hover:bg-emerald-400';
                          height = 'h-7';
                          titleText = `${tStr} • OK (${item.latency || latestLatency}ms)`;
                        } else if (h === false) {
                          colorClass = 'bg-rose-500 hover:bg-rose-400';
                          height = 'h-8';
                          titleText = `${tStr} • Probe Failed`;
                        } else {
                          titleText = `${tStr} • No data`;
                        }
                      }

                      if (isLast && h !== null) {
                        colorClass += ' animate-pulse';
                        height = 'h-8';
                      }

                      return (
                        <div
                          key={idx}
                          className={`flex-1 ${height} ${colorClass} rounded-[2px] transition-all duration-150 cursor-pointer group relative`}
                          title={titleText}
                        ></div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timeframe Legend */}
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span>{timeframe === '90d' ? (lang === 'id' ? '90 hari lalu' : '90 days ago') : timeframe === '30m' ? t.status.minsAgo : t.status.secsAgo}</span>
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> {lang === 'id' ? 'Operasional' : 'Operational'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> {lang === 'id' ? 'Terdegradasi' : 'Degraded'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> {lang === 'id' ? 'Gangguan' : 'Downtime'}
              </span>
            </span>
            <span>{timeframe === '90d' ? t.status.today : t.status.now}</span>
          </div>
        </div>

        {/* Live Refresher Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{lang === 'id' ? 'Pembaruan otomatis status setiap 5 detik' : 'Auto-refreshing live status every 5 seconds'}</span>
          </div>
          <button
            onClick={fetchStatus}
            className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{lang === 'id' ? 'Segarkan Sekarang' : 'Refresh Now'}</span>
          </button>
        </div>
      </main>
    </>
  );
}
