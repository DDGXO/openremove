'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useLanguage } from '@/context/LanguageContext';

export default function ApiDocs() {
  const { t } = useLanguage();
  const [theme, setTheme] = useState('dark');

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

  return (
    <>
      <Navbar theme={theme} toggleTheme={toggleTheme} />

      <main className="max-w-3xl w-full mx-auto px-6 py-12 flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
            {t.apiDocs.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.apiDocs.subtitle}
          </p>
        </div>

        <div className="space-y-8">
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono text-[11px] font-bold">GET</span>
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">/ping</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">{t.apiDocs.ep1Desc}</p>
            <pre className="bg-slate-950 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">curl -X GET http://localhost:3000/ping</pre>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono text-[11px] font-bold">POST</span>
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">/api/remove</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">{t.apiDocs.ep2Desc}</p>
            <pre className="bg-slate-950 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">curl -X POST "http://localhost:3000/api/remove?model=ben2" \
  -F "image=@photo.jpg" \
  --output result.png</pre>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-mono text-[11px] font-bold">GET</span>
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">/api/status</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">{t.apiDocs.ep3Desc}</p>
            <pre className="bg-slate-950 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">curl -X GET http://localhost:3000/api/status</pre>
          </div>
        </div>
      </main>
    </>
  );
}
