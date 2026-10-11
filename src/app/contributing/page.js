'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function ContributingPage() {
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
            {t.contributing.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.contributing.subtitle}
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{t.contributing.devSetupTitle}</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
              {t.contributing.devSetupDesc}
            </p>
            <pre className="bg-slate-950 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">git clone https://github.com/DDGXO/openremove.git
cd openremove
npm install
npm run next:dev</pre>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{t.contributing.prTitle}</h2>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
              {t.contributing.prItems.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 text-center flex items-center justify-center gap-4">
          <a
            href="https://github.com/DDGXO/openremove"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
          >
            {t.contributing.ghBtn}
          </a>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition"
          >
            {t.contributing.backBtn}
          </Link>
        </div>
      </main>
    </>
  );
}
