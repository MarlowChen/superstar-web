"use client";

import { Sparkles, Scissors, Paintbrush, Eraser, Maximize, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";

type Props = {
  visible: boolean;
  selectedCount: number;

  // Background Removal / Layer Separation
  onBackgroundRemove: () => void;
  onLayerSeparation: () => void;

  // Brush
  canUseBrush: boolean;
  isBrushOn: boolean;
  onBrushToggle: () => void;

  // Eraser
  canUseEraser?: boolean;
  isEraserOn?: boolean;
  onEraserToggle?: () => void;

  // Upscale
  canUpscale?: boolean;
  onUpscale?: (resolution: "2k" | "4k") => void;
};

export default function SelectedLayerToolbar({
  visible,
  selectedCount,
  onBackgroundRemove,
  canUseBrush,
  isBrushOn,
  onBrushToggle,
  canUseEraser = canUseBrush,
  isEraserOn = false,
  onEraserToggle = () => {},
  canUpscale = true,
  onUpscale = () => {},
}: Props) {
  const t = useTranslations("edited");
  const isSingle = selectedCount === 1;
  
  const [isUpscaleOpen, setIsUpscaleOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsUpscaleOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const containerClass = clsx(
    "pointer-events-auto absolute left-1/2 z-[70]",
    "bottom-0 top-auto",
    "md:top-4 md:bottom-auto",
    "rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur shadow-lg",
    "border border-gray-200 dark:border-gray-800"
  );

  const btnBase = "shrink-0 whitespace-nowrap p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -10, x: "-50%" }}
          className={containerClass}
        >
          <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2">
            {/* Selection Count */}
            <div className="shrink-0 flex items-center gap-1 sm:gap-2 pr-1 sm:pr-2 mr-1 border-r border-gray-200 dark:border-gray-800">
              <Sparkles size={14} className="sm:hidden text-purple-600" />
              <Sparkles size={16} className="hidden sm:block text-purple-600" />
              <span className="whitespace-nowrap text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100">
                <span className="sm:hidden">{selectedCount}</span>
                <span className="hidden sm:inline">
                  {t("selected_layers_count", { count: selectedCount })}
                </span>
              </span>
            </div>

            {/* Background Removal */}
            <button
              onClick={onBackgroundRemove}
              disabled={!isSingle}
              className={clsx(
                btnBase,
                isSingle
                  ? "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
              )}
              title={isSingle ? t("remove_background_single_layer") : t("need_single_layer_to_use")}
              aria-label={t("remove_background")}
            >
              <Scissors size={14} className="sm:hidden" />
              <Scissors size={16} className="hidden sm:block" />
              <span className="hidden sm:inline">{t("remove_background")}</span>
            </button>

            {/* Layer Separation (Commented Out) */}
            {/* <button
              onClick={onLayerSeparation}
              className={clsx(
                btnBase,
                "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200"
              )}
              title="Separate Layers"
              aria-label="Separate Layers"
            >
              <Layers size={14} className="sm:hidden" />
              <Layers size={16} className="hidden sm:block" />
              <span className="hidden sm:inline">Separate Layers</span>
            </button> */}

            {/* Upscale (Dropdown) */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => canUpscale && isSingle && setIsUpscaleOpen(!isUpscaleOpen)}
                disabled={!canUpscale || !isSingle}
                className={clsx(
                  btnBase,
                  !canUpscale || !isSingle
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                    : isUpscaleOpen
                    ? "bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"
                    : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-200"
                )}
                title={isSingle ? t("upscale") : t("need_single_layer_to_upscale")}
                aria-label={t("upscale")}
              >
                <Maximize size={14} className="sm:hidden" />
                <Maximize size={16} className="hidden sm:block" />
                <span className="hidden sm:inline">{t("upscale")}</span>
                <ChevronDown 
                  size={12} 
                  className={clsx(
                    "transition-transform duration-200",
                    isUpscaleOpen && "rotate-180"
                  )} 
                />
              </button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {isUpscaleOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className={clsx(
                      "absolute left-0 w-32 z-[80]",
                      "bg-white dark:bg-gray-900 rounded-xl shadow-lg",
                      "border border-gray-200 dark:border-gray-700",
                      "overflow-hidden",
                      "bottom-full mb-2 md:bottom-auto md:top-full md:mt-2 md:mb-0"
                    )}
                  >
                    <button
                      onClick={() => {
                        onUpscale("2k");
                        setIsUpscaleOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-sm text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-200 flex items-center justify-between"
                    >
                      <span>2K</span>
                      <span className="text-xs text-gray-400">2048px</span>
                    </button>
                    <div className="border-t border-gray-100 dark:border-gray-800" />
                    <button
                      onClick={() => {
                        onUpscale("4k");
                        setIsUpscaleOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-sm text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-200 flex items-center justify-between"
                    >
                      <span>4K</span>
                      <span className="text-xs text-gray-400">4096px</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Brush/Eraser Section */}
            <div className="shrink-0 flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 ml-1 border-l border-gray-200 dark:border-gray-800">
              {/* Brush */}
              <button
                onClick={onBrushToggle}
                disabled={!canUseBrush}
                className={clsx(
                  btnBase,
                  !canUseBrush
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                    : isBrushOn
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                )}
                title={
                  canUseBrush
                    ? isBrushOn
                      ? t("turn_off_brush")
                      : t("turn_on_brush")
                    : t("need_single_layer_to_draw")
                }
                aria-label={isBrushOn ? t("brush_active") : t("brush")}
              >
                <Paintbrush size={14} className="sm:hidden" />
                <Paintbrush size={16} className="hidden sm:block" />
                <span className="hidden sm:inline">
                  {isBrushOn ? t("brush_active") : t("brush")}
                </span>
              </button>

              {/* Eraser */}
              <button
                onClick={onEraserToggle}
                disabled={!canUseEraser}
                className={clsx(
                  btnBase,
                  !canUseEraser
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                    : isEraserOn
                    ? "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-200"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                )}
                title={
                  canUseEraser
                    ? isEraserOn
                      ? t("turn_off_eraser")
                      : t("turn_on_eraser")
                    : t("need_single_layer_to_erase")
                }
                aria-label={isEraserOn ? t("eraser_active") : t("eraser")}
              >
                <Eraser size={14} className="sm:hidden" />
                <Eraser size={16} className="hidden sm:block" />
                <span className="hidden sm:inline">
                  {isEraserOn ? t("eraser_active") : t("eraser")}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}