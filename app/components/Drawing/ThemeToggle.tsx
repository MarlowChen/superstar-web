'use client';
import { useState, useEffect, JSX } from 'react';

export default function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('system');
  // const [darkMode, setDarkMode] = useState<boolean>(false);

  // 初始化：根據 localStorage 或系統
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | 'system' | null;
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
      // setDarkMode(savedTheme === 'dark');
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      setTheme('system');
      const applySystemTheme = () => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        // setDarkMode(prefersDark);
        document.documentElement.classList.toggle('dark', prefersDark);
      };
      applySystemTheme();
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);
      return () => {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', applySystemTheme);
      };
    }
  }, []);

  // 切換主題
  const handleThemeChange = (newTheme: 'dark' | 'light' | 'system') => {
    setTheme(newTheme);
    if (newTheme === 'system') {
      localStorage.setItem('theme', 'system');
      // 不呼叫 updateTheme API，只做本地切換
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      // setDarkMode(prefersDark);
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      localStorage.setItem('theme', newTheme);
      // setDarkMode(newTheme === 'dark');
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      // 這裡如需呼叫 updateTheme API，請加上：
      // updateTheme(newTheme);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleThemeChange('light')}
        className={`p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'light' ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
        aria-label="切換到淺色模式"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      </button>
      <button
        onClick={() => handleThemeChange('dark')}
        className={`p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-indigo-400 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
        aria-label="切換到深色模式"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      </button>
      <button
        onClick={() => handleThemeChange('system')}
        className={`p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'system' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
        aria-label="跟隨系統"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M2 10a8 8 0 0116 0" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>
    </div>
  );
}