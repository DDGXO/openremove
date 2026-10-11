'use client';

import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { Upload, Sparkles, AlertCircle, Download, Sliders, CheckCircle2, Clock, Zap, ArrowRight, ArrowUpRight } from 'lucide-react';

const DEFAULT_MODELS = [
  { key: 'rmbg', label: 'RMBG' },
  { key: 'ben2', label: 'BEN2' },
  { key: 'silueta', label: 'SILUETA' },
  { key: 'isnet', label: 'ISNET' },
  { key: 'u2netp', label: 'U2NETP' },
];

const MODEL_SPECS = [
  {
    key: 'rmbg',
    name: 'BRIA RMBG-1.4',
    badge: 'Recommended Default',
    badgeColor: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    tensor: '1024 × 1024',
    cpuTime: '~1 - 2s',
    speedTier: 'Cepat',
    precision: 'Tinggi (~94%)',
    summary: 'Paling seimbang dan efisien. Bersih untuk 90% foto produk e-commerce, orang, dan objek umum.',
    whenToUse: 'Pilihan utama harian. Pakai ini dulu agar proses tidak buang waktu.',
  },
  {
    key: 'ben2',
    name: 'BEN2 (Bilateral Engine)',
    badge: 'SOTA ~99% Precision',
    badgeColor: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    tensor: '1024 × 1024',
    cpuTime: '~20 - 35s',
    speedTier: 'Berat',
    precision: 'Maksimal (~99%)',
    summary: 'Alpha channel matting tingkat tinggi. Menjaga helaian rambut acak, bulu hewan, dan pinggiran semi-transparan.',
    whenToUse: 'Hanya pakai jika RMBG gagal memisahkan detail rambut halus atau bulu rumit.',
  },
  {
    key: 'silueta',
    name: 'Silueta',
    badge: 'Ultra Fast (~150ms)',
    badgeColor: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800',
    tensor: '320 × 320',
    cpuTime: '~0.15s',
    speedTier: 'Instan',
    precision: 'Standar (~85%)',
    summary: 'Inferensi instan di CPU dengan konsumsi memori minimal. Mengutamakan kecepatan potong di atas detail helai.',
    whenToUse: 'Pemrosesan batch banyak file, logo, stiker grafis, dan foto dengan kontras latar tajam.',
  },
  {
    key: 'isnet',
    name: 'IS-Net (DIS)',
    badge: 'Sharp Edge Specialist',
    badgeColor: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    tensor: '1024 × 1024',
    cpuTime: '~4 - 6s',
    speedTier: 'Sedang',
    precision: 'Sangat Rapi (~95%)',
    summary: 'Spesialis batas pemisah padat (Dichotomous Segmentation). Tepi potongan tegas tanpa artefak blur.',
    whenToUse: 'Objek solid tanpa rambut: baju, sepatu, suku cadang, kendaraan, dan produk manufaktur.',
  },
  {
    key: 'u2netp',
    name: 'U²-NetP Compact',
    badge: 'Ultra-Light 4.7 MB',
    badgeColor: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    tensor: '320 × 320',
    cpuTime: '~0.5s',
    speedTier: 'Cepat',
    precision: 'Dasar (~82%)',
    summary: 'Ukuran file ONNX sangat kecil (4.7 MB). Pemotongan foreground dasar dengan jejak RAM minimal.',
    whenToUse: 'Opsi darurat jika hardware server CPU atau RAM sangat terbatas.',
  },
];

export default function Home() {
  const { t } = useLanguage();
  const [theme, setTheme] = useState('dark');
  const [modelStatuses, setModelStatuses] = useState({
    rmbg: { status: 'loading' },
    ben2: { status: 'loading' },
    silueta: { status: 'loading' },
    isnet: { status: 'loading' },
    u2netp: { status: 'loading' },
  });
  const [selectedModel, setSelectedModel] = useState('rmbg');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, statusText: '', log: '', queuePos: 0, estSec: 0 });
  const [result, setResult] = useState(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const comparisonBoxRef = useRef(null);
  const heroSectionRef = useRef(null);

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
    try {
      const res = await fetch('/api/status?t=' + Date.now());
      if (!res.ok) return;
      const data = await res.json();
      if (data.backend && data.backend.models) {
        const next = {};
        for (const [key, meta] of Object.entries(data.backend.models)) {
          let s = 'offline';
          if (meta.comingSoon || meta.status === 'planned') {
            s = 'soon';
          } else if (meta.loaded || meta.status === 'operational') {
            s = 'ready';
          }
          next[key] = {
            ...meta,
            status: s,
          };
        }
        setModelStatuses((prev) => ({ ...prev, ...next }));
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle clipboard paste (Ctrl + V)
  useEffect(() => {
    const handlePaste = (e) => {
      if (uploading) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) handleUpload(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [uploading, selectedModel, modelStatuses]);

  // Handle comparison slider dragging
  useEffect(() => {
    if (!isDragging) return;

    const updateSlider = (clientX) => {
      if (!comparisonBoxRef.current) return;
      const rect = comparisonBoxRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setSliderPos(pct);
    };

    const handleMouseMove = (e) => {
      e.preventDefault();
      updateSlider(e.clientX);
    };

    const handleTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        updateSlider(e.touches[0].clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  const currentModelMeta = modelStatuses[selectedModel] || { status: 'loading' };
  const isSelectedLoading = currentModelMeta.status === 'loading';
  const isSelectedOffline = currentModelMeta.status === 'offline';
  const isSelectedComingSoon = currentModelMeta.status === 'soon';

  const selectAndScrollToTop = (key) => {
    setSelectedModel(key);
    heroSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleUpload = async (file) => {
    if (!file || isSelectedOffline || isSelectedComingSoon || isSelectedLoading) return;

    setUploading(true);
    setResult(null);
    setProgress({
      percent: 2,
      statusText: t.hero.uploading,
      log: `Model: ${currentModelMeta.name || selectedModel.toUpperCase()}`,
      queuePos: 0,
      estSec: 0,
    });

    const formData = new FormData();
    formData.append('image', file);
    formData.append('model', selectedModel);

    try {
      const upRes = await fetch(`/api/upload?model=${encodeURIComponent(selectedModel)}`, {
        method: 'POST',
        body: formData,
      });
      const upData = await upRes.json();
      if (!upRes.ok || !upData.jobId) throw new Error(upData.error || 'Upload failed');

      setProgress((p) => ({ ...p, percent: 5, statusText: t.hero.connecting }));

      const es = new EventSource(`/api/process-stream/${upData.jobId}?model=${encodeURIComponent(selectedModel)}`);

      es.addEventListener('progress', (e) => {
        const d = JSON.parse(e.data);
        setProgress({
          percent: d.percent,
          statusText: d.statusText,
          log: d.log,
          queuePos: d.queuePosition || 0,
          estSec: d.estimatedSeconds || 0,
        });
      });

      es.addEventListener('complete', (e) => {
        const d = JSON.parse(e.data);
        es.close();
        setUploading(false);
        setResult({
          resultUrl: d.resultUrl,
          originalUrl: d.originalUrl,
          durationMs: d.durationMs,
          metadata: d.metadata || {},
          downloadName: d.downloadName || 'openremove.png',
        });
      });

      const onError = (e) => {
        es.close();
        let msg = 'Inference failed.';
        if (e && e.data) {
          try {
            msg = JSON.parse(e.data).error || msg;
          } catch (_) {}
        }
        alert('Error: ' + msg);
        setUploading(false);
      };

      es.addEventListener('app_error', onError);
      es.addEventListener('error', onError);
    } catch (err) {
      alert('Error: ' + err.message);
      setUploading(false);
    }
  };

  return (
    <>
      <Navbar theme={theme} toggleTheme={toggleTheme} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 flex flex-col font-sans">
        {/* BAGIAN 1: HERO FOLD (Fokus Murni RIB & Upload Terpusat) */}
        <section
          ref={heroSectionRef}
          className="min-h-[calc(100vh-72px)] flex items-center justify-center py-8 w-full"
        >
          <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14">
            
            {/* Sisi Kiri: Teks & Model Selector */}
            <div className="flex-1 w-full flex flex-col items-center lg:items-start text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] mb-4">
                {t.hero.titleLine1} <br className="hidden sm:inline" />
                {t.hero.titleLine2}
              </h1>

              <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-300 font-medium mb-6 flex items-center justify-center lg:justify-start gap-2.5 flex-wrap">
                <span>{t.hero.subtitle}</span>
                <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-bold text-sm sm:text-base shadow-sm">
                  {t.hero.free}
                </span>
              </p>

              {/* AI Model Selector Pills */}
              <div className="w-full max-w-md">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-center lg:justify-start gap-1.5 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{t.hero.activeModel}</span>
                </div>

                <div className="p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center lg:justify-start gap-1 flex-wrap">
                  {DEFAULT_MODELS.map(({ key, label }) => {
                    const isSelected = selectedModel === key;
                    const meta = modelStatuses[key] || { status: 'loading' };
                    const isLoading = meta.status === 'loading';
                    const isOffline = meta.status === 'offline';
                    const isComingSoon = meta.status === 'soon';

                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedModel(key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 font-sans ${
                          isSelected
                            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        } ${isOffline ? 'opacity-50' : ''}`}
                      >
                        <span className="tracking-tight">{label}</span>
                        {isLoading ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 animate-pulse font-mono">
                            Loading...
                          </span>
                        ) : isComingSoon ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-mono">
                            Soon
                          </span>
                        ) : isOffline ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-mono">
                            Offline
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-mono font-medium">
                            Ready
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Catatan Pendek */}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 flex items-center justify-center lg:justify-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span>{t.hero.ben2Tip}</span>
                </p>
              </div>

              {/* Alert jika model offline / soon */}
              {(isSelectedOffline || isSelectedComingSoon) && (
                <div className="w-full max-w-md mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    {isSelectedComingSoon
                      ? `Model ${selectedModel.toUpperCase()} ${t.hero.soonNotice}`
                      : `Model ${selectedModel.toUpperCase()} ${t.hero.offlineNotice}`}
                  </span>
                </div>
              )}
            </div>

            {/* Sisi Kanan: Kotak Upload Terpusat */}
            <div className="w-full lg:w-[460px] shrink-0 flex flex-col items-center">
              {!uploading && !result && (
                <div
                  onClick={() => !isSelectedOffline && !isSelectedComingSoon && !isSelectedLoading && fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
                  }}
                  className={`w-full bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center transition shadow-lg ${
                    isSelectedOffline || isSelectedComingSoon || isSelectedLoading
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:border-blue-500 cursor-pointer hover:shadow-xl'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />

                  <button
                    disabled={isSelectedOffline || isSelectedComingSoon || isSelectedLoading}
                    className="w-full max-w-xs py-4 px-8 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-base sm:text-lg shadow-md transition active:scale-95 inline-flex items-center justify-center gap-3 mb-4 cursor-pointer"
                  >
                    <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span>{t.hero.uploadBtn}</span>
                  </button>

                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                    {t.hero.orDrop}
                  </p>

                  <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
                    <span>{t.hero.pasteWith}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      Ctrl + V
                    </kbd>
                  </p>

                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500">
                    {t.hero.terms}{' '}
                    <Link href="/privacy" className="underline hover:text-slate-700 dark:hover:text-slate-300">
                      {t.hero.privacyPolicy}
                    </Link>.
                  </div>
                </div>
              )}

              {/* Progress Box Saat Proses Unggah */}
              {uploading && (
                <div className="w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center shadow-lg">
                  <div className="w-full flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{progress.statusText}</span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">{progress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden mb-4">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-200"
                      style={{ width: `${progress.percent}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono w-full truncate bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    {progress.log || t.hero.runningEngine}
                  </p>
                </div>
              )}

              {/* Preview & Slider Hasil */}
              {result && (
                <div className="w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center shadow-lg">
                  <div
                    ref={comparisonBoxRef}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                      if (comparisonBoxRef.current) {
                        const rect = comparisonBoxRef.current.getBoundingClientRect();
                        const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                        setSliderPos(pct);
                      }
                    }}
                    onTouchStart={(e) => {
                      setIsDragging(true);
                      if (comparisonBoxRef.current && e.touches && e.touches[0]) {
                        const rect = comparisonBoxRef.current.getBoundingClientRect();
                        const pct = Math.max(0, Math.min(100, ((e.touches[0].clientX - rect.left) / rect.width) * 100));
                        setSliderPos(pct);
                      }
                    }}
                    className="comparison-stage checkerboard-pattern border border-slate-200 dark:border-slate-700 mb-6 cursor-ew-resize relative rounded-2xl overflow-hidden w-full select-none"
                    style={{ '--slider-pos': `${sliderPos}%`, userSelect: 'none', WebkitUserSelect: 'none' }}
                  >
                    <img
                      src={result.resultUrl}
                      alt="Result"
                      className="layer-after pointer-events-none select-none"
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                    />
                    <img
                      src={result.originalUrl}
                      alt="Original"
                      className="layer-before pointer-events-none select-none"
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                    />
                    <div className="slider-line pointer-events-none"></div>
                    <div className="slider-button pointer-events-none">
                      <Sliders className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-500 font-mono">
                      {t.hero.duration}: {(result.durationMs / 1000).toFixed(2)}s &bull; {t.hero.model}: {result.metadata.modelUsed || selectedModel}
                    </span>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => setResult(null)}
                        className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        {t.hero.uploadAnother}
                      </button>
                      <a
                        href={result.resultUrl}
                        download={result.downloadName}
                        className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        {t.hero.download}
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* BAGIAN 2: BENCHMARK & PERBANDINGAN TEKNIS MODEL (Non-AI Slop, Data Konkret & Matrix) */}
        <section className="w-full border-t border-slate-200 dark:border-slate-800 py-16 sm:py-20">
          <div className="max-w-2xl mb-10">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-3">
              <span>{t.guide.tag}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
              {t.guide.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.guide.subtitle}
            </p>
          </div>

          {/* Tabel Matrix Teknis */}
          <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm mb-10">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4 font-semibold">{t.guide.colModel}</th>
                  <th className="py-3.5 px-4 font-semibold">{t.guide.colTensor}</th>
                  <th className="py-3.5 px-4 font-semibold">{t.guide.colTime}</th>
                  <th className="py-3.5 px-4 font-semibold">{t.guide.colPrecision}</th>
                  <th className="py-3.5 px-4 font-semibold">{t.guide.colUse}</th>
                  <th className="py-3.5 px-4 text-right font-semibold">{t.guide.colAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                {MODEL_SPECS.map((m) => {
                  const isSelected = selectedModel === m.key;
                  const modelTrans = t.models?.[m.key] || {};
                  return (
                    <tr
                      key={m.key}
                      className={`transition ${
                        isSelected
                          ? 'bg-blue-50/40 dark:bg-blue-950/20'
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{m.name}</span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                          )}
                        </div>
                        <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded border font-mono ${m.badgeColor}`}>
                          {modelTrans.badge || m.badge}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {m.tensor}
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {m.cpuTime}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {modelTrans.precision || m.precision}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed">
                        <p className="font-medium text-slate-900 dark:text-slate-100 mb-0.5">{modelTrans.summary || m.summary}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{modelTrans.whenToUse || m.whenToUse}</p>
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => selectAndScrollToTop(m.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer font-sans ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {isSelected ? t.guide.btnActive : t.guide.btnSelect}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rule of Thumb / Panduan Praktis Singkat */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60">
              <h3 className="font-bold text-amber-900 dark:text-amber-200 mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                {t.guide.calloutBen2Title}
              </h3>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                {t.guide.calloutBen2Desc}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60">
              <h3 className="font-bold text-emerald-900 dark:text-emerald-200 mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {t.guide.calloutRmbgTitle}
              </h3>
              <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                {t.guide.calloutRmbgDesc}
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full border-t border-slate-200 dark:border-slate-800 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>{t.footer.copy}</span>
          <div className="flex items-center gap-5 flex-wrap">
            <Link href="/how-to-use" className="hover:text-slate-900 dark:hover:text-white transition">
              {t.nav.howToUse}
            </Link>
            <Link href="/api-docs" className="hover:text-slate-900 dark:hover:text-white transition">
              {t.nav.api}
            </Link>
            <Link href="/status" className="hover:text-slate-900 dark:hover:text-white transition">
              {t.nav.status}
            </Link>
            <Link href="/faq" className="hover:text-slate-900 dark:hover:text-white transition">
              {t.nav.faq}
            </Link>
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition">
              {t.nav.privacy}
            </Link>
            <Link href="/contributing" className="hover:text-slate-900 dark:hover:text-white transition">
              {t.nav.contributing}
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
