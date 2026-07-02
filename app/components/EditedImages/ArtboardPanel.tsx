"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Lock, Unlock, Ruler, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";

/* =======================
   Types
   ======================= */
interface ArtboardSize {
  width: number;
  height: number;
}

interface ArtboardPanelProps {
  open: boolean;
  current: ArtboardSize;
  onOpenChange: (open: boolean) => void;
  onApply: (payload: { width: number; height: number }) => void;
}

/* =======================
   Constants
   ======================= */
const MAX_SIZE = 4096;
const MIN_SIZE = 1;

/* =======================
   Component
   ======================= */
export default function ArtboardPanel({
  open,
  current,
  onOpenChange,
  onApply,
}: ArtboardPanelProps) {
  const t = useTranslations("edited");
  const [wValue, setWValue] = useState(current.width);
  const [hValue, setHValue] = useState(current.height);
  const [lock, setLock] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const aspect = useMemo(() => current.width / current.height, [current]);

  const PRESET_SIZES = useMemo(() => [
    { label: t("instagram_post"), width: 1080, height: 1080 },
    { label: t("instagram_story"), width: 1080, height: 1920 },
    { label: t("youtube_thumbnail"), width: 1280, height: 720 },
    { label: t("full_hd"), width: 1920, height: 1080 },
    { label: t("4k"), width: 3840, height: 2160 },
    { label: t("a4_300dpi"), width: 2480, height: 3508 },
  ], [t]);

  // 偵測螢幕尺寸
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Click outside to close (僅桌面版)
  useEffect(() => {
    if (!open || isMobile) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange, isMobile]);

  // Sync current
  useEffect(() => {
    if (open) {
      setWValue(current.width);
      setHValue(current.height);
    }
  }, [open, current]);

  // 鎖定 body scroll（手機版開啟時）
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open, isMobile]);

  const onChangeWidth = (val: number) => {
    const v = Math.max(MIN_SIZE, Math.min(MAX_SIZE, val || MIN_SIZE));
    setWValue(v);
    if (lock) setHValue(Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(v / aspect))));
  };

  const onChangeHeight = (val: number) => {
    const v = Math.max(MIN_SIZE, Math.min(MAX_SIZE, val || MIN_SIZE));
    setHValue(v);
    if (lock) setWValue(Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(v * aspect))));
  };

  const handleApply = () => {
    onApply({ width: wValue, height: hValue });
    onOpenChange(false);
  };

  const selectPreset = (w: number, h: number) => {
    const width = Math.min(w, MAX_SIZE);
    const height = Math.min(h, MAX_SIZE);
    onApply({ width, height });
    onOpenChange(false);
  };

  // 共用的面板內容
  const PanelContent = () => (
    <>
      {/* Custom size */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-500 mb-3">{t("custom_size")}</p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block md:hidden">{t("width")}</label>
            <input
              type="number"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={wValue}
              onChange={(e) => onChangeWidth(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:border-purple-500"
            />
          </div>
          <span className="text-gray-400 mt-4 md:mt-0">×</span>
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block md:hidden">{t("height")}</label>
            <input
              type="number"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={hValue}
              onChange={(e) => onChangeHeight(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:border-purple-500"
            />
          </div>
          <button
            onClick={() => setLock(!lock)}
            className={`p-2 rounded-lg border transition-colors mt-4 md:mt-0 ${
              lock
                ? "bg-purple-100 dark:bg-purple-900/40 border-purple-300 text-purple-600"
                : "border-gray-200 dark:border-gray-700 text-gray-400"
            }`}
          >
            {lock ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
        </div>
        <button
          onClick={handleApply}
          className="w-full mt-3 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors active:scale-[0.98]"
        >
          {t("apply")}
        </button>
      </div>

      {/* Preset sizes */}
      <div className="max-h-64 md:max-h-64 overflow-y-auto">
        <p className="px-4 pt-3 pb-2 text-xs text-gray-500 sticky top-0 bg-white dark:bg-gray-900">
          {t("presets")}
        </p>
        {PRESET_SIZES.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => selectPreset(preset.width, preset.height)}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:bg-gray-100 dark:active:bg-gray-700 ${
              current.width === preset.width && current.height === preset.height
                ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600"
                : ""
            }`}
          >
            <span>{preset.label}</span>
            <span className="text-xs text-gray-400">
              {preset.width} × {preset.height}
            </span>
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => onOpenChange(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
        title={t("canvas_size")}
      >
        <Ruler size={18} className="text-gray-600 dark:text-gray-300" />
        <span className="hidden sm:inline text-gray-600 dark:text-gray-300">
          {current.width} × {current.height}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Desktop: Dropdown */}
      <AnimatePresence>
        {open && !isMobile && (
          <motion.div
            initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
          >
            <PanelContent />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile: Bottom Sheet */}
      <AnimatePresence>
        {open && isMobile && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-[100]"
              onClick={() => onOpenChange(false)}
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl z-[101] max-h-[85vh] overflow-hidden"
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-base font-semibold">{t("canvas_size")}</h3>
                <button
                  onClick={() => onOpenChange(false)}
                  className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
                <PanelContent />
              </div>

              {/* Safe area for iOS */}
              <div className="h-[env(safe-area-inset-bottom)]" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}