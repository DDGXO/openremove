'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useLanguage } from '@/context/LanguageContext';

export default function HowToUse() {
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
            {t.howToUse.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.howToUse.subtitle}
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">1</span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{t.howToUse.step1Title}</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed ml-10">
              {t.howToUse.step1DescStart}<strong>{t.howToUse.step1DescBen2}</strong><strong>{t.howToUse.step1DescSilueta}</strong><strong>{t.howToUse.step1DescIsnet}</strong><strong>{t.howToUse.step1DescUpload}</strong>{t.howToUse.step1DescMiddle}<kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[11px]">Ctrl + V</kbd>.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">2</span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{t.howToUse.step2Title}</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed ml-10">
              {t.howToUse.step2Desc}
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">3</span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{t.howToUse.step3Title}</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed ml-10">
              {t.howToUse.step3DescStart}<strong>{t.howToUse.step3DescDownload}</strong>{t.howToUse.step3DescEnd}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
