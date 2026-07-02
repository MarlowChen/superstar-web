"use client";
import React, { useEffect, ReactNode, forwardRef } from "react";
import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

interface DrawerModelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

const DrawerModelSelector = forwardRef<
  HTMLDivElement,
  DrawerModelSelectorProps
>(({ isOpen, onClose, children }, ref) => {
  const t = useTranslations("models");
  const locale = useLocale();
  const modelGalleryTitle =
    locale === "zh-TW" ? "模型倉庫" : locale === "ja" ? "モデルギャラリー" : t("model_gallery_title");
  const selectModelTitle =
    locale === "zh-TW" ? "選擇你喜歡的模型" : locale === "ja" ? "好きなモデルを選択" : t("selectModel");

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!isOpen}
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={selectModelTitle}
          className={`relative flex h-[min(88vh,860px)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/50 bg-[#f7fbff] shadow-[0_28px_80px_rgba(15,39,61,0.28)] transition-all duration-200 dark:border-white/10 dark:bg-[#0f1822] ${
            isOpen
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-4 scale-[0.98] opacity-0"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(73,201,255,0.22),transparent_56%),linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_top_left,rgba(73,201,255,0.18),transparent_56%),linear-gradient(180deg,rgba(15,24,34,0.9),rgba(15,24,34,0))]" />

          <div className="relative z-10 flex items-center justify-between border-b border-[#d7e7f3] px-5 py-4 dark:border-white/10 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6a91af] dark:text-[#7fb8d8]">{modelGalleryTitle}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#16324a] dark:text-[#eef8ff]">
                {selectModelTitle}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d4e5f2] bg-white/85 text-[#476a87] transition hover:border-[#8fd8ff] hover:text-[#16324a] dark:border-white/10 dark:bg-white/5 dark:text-[#c7deee] dark:hover:border-[#49c9ff] dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto bg-transparent">
            <div className="content-scrollbar min-h-full px-4 py-5 pb-8 sm:px-6 sm:py-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

DrawerModelSelector.displayName = "DrawerModelSelector";
export default DrawerModelSelector;
