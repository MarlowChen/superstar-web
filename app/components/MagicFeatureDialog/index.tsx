"use client";

import React, { useEffect, useState } from "react";
import { X, Rocket, Sparkles, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl"; // ✅ 改用 next-intl

interface MagicFeatureDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const MagicFeatureDialog: React.FC<MagicFeatureDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // ✅ 使用 next-intl 的 hook，對應上面 JSON 的 key
  const t = useTranslations("magicFeature");

  // 處理動畫延遲，讓彈出效果更滑順
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // 禁止背景滾動
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = "unset";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300 ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* 背景遮罩 (Backdrop) */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 對話框本體 */}
      <div
        className={`
          relative w-full max-w-4xl mx-4 md:mx-auto 
          bg-[#0f1115] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden
          transform transition-all duration-300 ease-out
          flex flex-col max-h-[90vh]
          ${isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}
        `}
      >
        {/* --- Header 區域 --- */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#13151b]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg">
              <Rocket className="w-5 h-5 text-pink-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-base tracking-wide">
                {t("badge")}
              </span>
              <span className="text-xs text-gray-500 font-mono mt-0.5">
                {t("version")}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* --- Scrollable Content 區域 --- */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-[#0f1115]">
          
          {/* 標題區 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
              <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
                {t("title")}
              </h2>
            </div>
            <p className="text-gray-400 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
              {t("description")}
            </p>
          </div>

          {/* 影片展示區 (保持 Aspect Ratio) */}
          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-800 shadow-[0_0_40px_-10px_rgba(168,85,247,0.15)] bg-black group">
            {/* YouTube Embed 
                注意：為了讓體驗更好，我加回了 autoplay=1&mute=1，
                這樣彈窗出來時影片會自動無聲播放 (類似 Kling 效果)
            */}
            <iframe 
              width="100%" 
              height="100%" 
              src="https://www.youtube.com/embed/gSAWn5itmXc?si=s8dDAmM0rOb0LmTK&autoplay=1&mute=1&loop=1&playlist=gSAWn5itmXc" 
              title="AI Magic Editor Demo" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            ></iframe>
            
            {/* Loading 佔位 */}
            <div className="absolute inset-0 flex items-center justify-center -z-10">
              <div className="w-8 h-8 border-2 border-gray-700 border-t-purple-500 rounded-full animate-spin"></div>
            </div>
          </div>
        </div>

        {/* --- Footer 操作區 --- */}
        <div className="p-6 border-t border-gray-800 bg-[#13151b] flex flex-col-reverse md:flex-row items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="w-full md:w-auto group relative px-8 py-2.5 rounded-lg text-white text-sm font-bold overflow-hidden shadow-lg shadow-purple-900/20"
          >
            {/* 按鈕背景漸層 */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* 按鈕內容 */}
            <div className="relative flex items-center justify-center gap-2">
              {t("button")}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MagicFeatureDialog;