"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Type,
  Bold,
  Italic,
  Underline,
  Minus,
  Plus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
} from "lucide-react";
import clsx from "clsx"; // 引入 clsx 方便樣式組合

/**
 * 文字屬性介面
 */
export interface TextProperties {
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  underline?: boolean;
  linethrough?: boolean;
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  charSpacing?: number;
}

/**
 * 組件 Props
 */
export interface TextToolbarProps {
  textId: string;
  properties: TextProperties;
  onUpdate: (properties: Partial<TextProperties>) => void;
  position?: "floating" | "fixed" | "inline";
  className?: string;
}

/**
 * 常用字型列表
 */
const FONTS = [
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier New" },
  { value: "Verdana", label: "Verdana" },
  { value: "Comic Sans MS", label: "Comic Sans MS" },
  { value: "Impact", label: "Impact" },
  { value: "Noto Sans TC", label: "Noto Sans TC" },
  { value: "Noto Serif TC", label: "Noto Serif TC" },
  { value: "Inter" , label: "Inter" }
];

/**
 * 字型大小列表 (已合併到邏輯中，不再單獨定義陣列)
 */

/**
 * 文字工具列組件（桌面版）
 */
export default function TextToolbar({
  properties,
  onUpdate,
  position = "floating",
  className = "",
}: TextToolbarProps) {
  const t = useTranslations("edited");
  const [showFontMenu, setShowFontMenu] = useState(false);

  // 響應式判斷
  // const [isMobile, setIsMobile] = useState(false);

  // useEffect(() => {
  //   const checkMobile = () => setIsMobile(window.innerWidth < 1024);
  //   checkMobile();
  //   window.addEventListener("resize", checkMobile);
  //   return () => window.removeEventListener("resize", checkMobile);
  // }, []);

  // 處理字型大小變更
  const handleFontSizeChange = useCallback(
    (delta: number) => {
      const currentSize = properties.fontSize || 32;
      const newSize = Math.max(12, Math.min(120, currentSize + delta));
      onUpdate({ fontSize: newSize });
    },
    [properties.fontSize, onUpdate]
  );

  // 處理樣式切換
  const toggleStyle = useCallback(
    (style: "bold" | "italic" | "underline") => {
      switch (style) {
        case "bold":
          onUpdate({
            fontWeight: properties.fontWeight === "bold" ? "normal" : "bold",
          });
          break;
        case "italic":
          onUpdate({
            fontStyle: properties.fontStyle === "italic" ? "normal" : "italic",
          });
          break;
        case "underline":
          onUpdate({ underline: !properties.underline });
          break;
      }
    },
    [properties, onUpdate]
  );

  // 處理對齊
  const handleAlign = useCallback(
    (align: "left" | "center" | "right") => {
      onUpdate({ textAlign: align });
    },
    [onUpdate]
  );

  // 如果是手機版，返回簡化版
  // if (isMobile) {
  //   return (
  //     <TextToolbarMobile
  //       properties={properties}
  //       onUpdate={onUpdate}
  //       className={className}
  //     />
  //   );
  // }

  // 容器樣式 (桌面版)
  // 🌟 核心修正: 使用 clsx 組合樣式，並確保 floating 模式使用 absolute left-1/2
  const containerClass = clsx(
    // 樣式定位
    {
      "absolute top-auto md:top-4 left-1/2 z-[70]": position === "floating", // 參考 SelectedLayerToolbar 模式
      "sticky top-0 z-40": position === "fixed",
    },
    // 外觀樣式
    "bg-white dark:bg-gray-900",
    "rounded-xl shadow-2xl",
    "border border-gray-200 dark:border-gray-700",
    "px-3 py-2",
    "flex items-center gap-2",
    className
  );

  return (
    // 🌟 Framer Motion 實現動畫和置中
    <AnimatePresence>
      <motion.div
        // 🌟 關鍵修正: 將水平置中 x: "-50%" 整合到 Framer Motion 的 transform 中
        initial={{ opacity: 0, y: -10, x: "-50%" }} 
        animate={{ opacity: 1, y: 0, x: "-50%" }}
        exit={{ opacity: 0, y: -10, x: "-50%" }}
        className={containerClass}
      >
        {/* 字型選擇器 */}
        <div className="relative">
          <button
            onClick={() => setShowFontMenu(!showFontMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-w-[140px]"
          >
            <Type size={16} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium truncate">
              {properties.fontFamily || "Arial"}
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {/* 字型下拉選單 */}
          <AnimatePresence>
            {showFontMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 max-h-64 overflow-y-auto z-50"
              >
                {FONTS.map((font) => (
                  <button
                    key={font.value}
                    onClick={() => {
                      onUpdate({ fontFamily: font.value });
                      setShowFontMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    style={{ fontFamily: font.value }}
                  >
                    <span className="text-sm">{font.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 分隔線 */}
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

        {/* 字型大小控制 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleFontSizeChange(-2)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={t("decrease_font_size")}
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            value={properties.fontSize || 32}
            onChange={(e) =>
              onUpdate({ fontSize: parseInt(e.target.value) || 32 })
            }
            className="w-16 text-center px-2 py-1 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
          />
          <button
            onClick={() => handleFontSizeChange(2)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={t("increase_font_size")}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* 分隔線 */}
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

        {/* 文字顏色 */}
        <div className="relative">
          <input
            type="color"
            value={properties.fill as string || "#000000"}
            onChange={(e) => onUpdate({ fill: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer"
            title={t("text_color")}
          />
        </div>

        {/* 樣式按鈕組 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleStyle("bold")}
            className={[
              "p-2 rounded-lg transition-all",
              properties.fontWeight === "bold"
                ? "bg-purple-600 text-white"
                : "hover:bg-gray-100 dark:hover:bg-gray-800",
            ].join(" ")}
            aria-label={t("bold")}
          >
            <Bold size={16} />
          </button>
          <button
            onClick={() => toggleStyle("italic")}
            className={[
              "p-2 rounded-lg transition-all",
              properties.fontStyle === "italic"
                ? "bg-purple-600 text-white"
                : "hover:bg-gray-100 dark:hover:bg-gray-800",
            ].join(" ")}
            aria-label={t("italic")}
          >
            <Italic size={16} />
          </button>
          <button
            onClick={() => toggleStyle("underline")}
            className={[
              "p-2 rounded-lg transition-all",
              properties.underline
                ? "bg-purple-600 text-white"
                : "hover:bg-gray-100 dark:hover:bg-gray-800",
            ].join(" ")}
            aria-label={t("underline")}
          >
            <Underline size={16} />
          </button>
        </div>

        {/* 分隔線 */}
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

        {/* 對齊按鈕組 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleAlign("left")}
            className={[
              "p-2 rounded-lg transition-all",
              properties.textAlign === "left"
                ? "bg-purple-600 text-white"
                : "hover:bg-gray-100 dark:hover:bg-gray-800",
            ].join(" ")}
            aria-label={t("align_left")}
          >
            <AlignLeft size={16} />
          </button>
          <button
            onClick={() => handleAlign("center")}
            className={[
              "p-2 rounded-lg transition-all",
              properties.textAlign === "center"
                ? "bg-purple-600 text-white"
                : "hover:bg-gray-100 dark:hover:bg-gray-800",
            ].join(" ")}
            aria-label={t("align_center")}
          >
            <AlignCenter size={16} />
          </button>
          <button
            onClick={() => handleAlign("right")}
            className={[
              "p-2 rounded-lg transition-all",
              properties.textAlign === "right"
                ? "bg-purple-600 text-white"
                : "hover:bg-gray-100 dark:hover:bg-gray-800",
            ].join(" ")}
            aria-label={t("align_right")}
          >
            <AlignRight size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * 手機版文字工具列
 */
// function TextToolbarMobile({
//   properties,
//   onUpdate,
//   className = "",
// }: Omit<TextToolbarProps, "textId" | "position">) {
//   const [expanded, setExpanded] = useState(false);

//   return (
//     <div
//       className={clsx(
//         "fixed bottom-0 left-0 right-0 z-50",
//         "bg-white dark:bg-gray-900",
//         "border-t border-gray-200 dark:border-gray-800",
//         className
//       )}
//     >
//       {/* 收合版 */}
//       <div className="flex items-center justify-between px-4 py-3">
//         <div className="flex items-center gap-2 flex-1">
//           <select
//             value={properties.fontFamily || "Arial"}
//             onChange={(e) => onUpdate({ fontFamily: e.target.value })}
//             className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
//           >
//             {FONTS.map((font) => (
//               <option key={font.value} value={font.value}>
//                 {font.label}
//               </option>
//             ))}
//           </select>
//           <input
//             type="number"
//             value={properties.fontSize || 32}
//             onChange={(e) =>
//               onUpdate({ fontSize: parseInt(e.target.value) || 32 })
//             }
//             className="w-16 text-center px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
//           />
//         </div>
//         <button
//           onClick={() => setExpanded(!expanded)}
//           className="ml-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
//         >
//           <MoreHorizontal size={20} />
//         </button>
//       </div>

//       {/* 展開版 */}
//       <AnimatePresence>
//         {expanded && (
//           <motion.div
//             initial={{ height: 0, opacity: 0 }}
//             animate={{ height: "auto", opacity: 1 }}
//             exit={{ height: 0, opacity: 0 }}
//             className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 space-y-3 overflow-hidden"
//           >
//             {/* 樣式按鈕 */}
//             <div className="flex items-center gap-2">
//               <button
//                 onClick={() =>
//                   onUpdate({
//                     fontWeight: properties.fontWeight === "bold" ? "normal" : "bold",
//                   })
//                 }
//                 className={clsx(
//                   "flex-1 py-3 rounded-lg font-bold transition-all",
//                   properties.fontWeight === "bold"
//                     ? "bg-purple-600 text-white"
//                     : "bg-gray-100 dark:bg-gray-800"
//                 )}
//               >
//                 B
//               </button>
//               <button
//                 onClick={() =>
//                   onUpdate({
//                     fontStyle: properties.fontStyle === "italic" ? "normal" : "italic",
//                   })
//                 }
//                 className={clsx(
//                   "flex-1 py-3 rounded-lg italic transition-all",
//                   properties.fontStyle === "italic"
//                     ? "bg-purple-600 text-white"
//                     : "bg-gray-100 dark:bg-gray-800"
//                 )}
//               >
//                 I
//               </button>
//               <button
//                 onClick={() => onUpdate({ underline: !properties.underline })}
//                 className={clsx(
//                   "flex-1 py-3 rounded-lg underline transition-all",
//                   properties.underline
//                     ? "bg-purple-600 text-white"
//                     : "bg-gray-100 dark:bg-gray-800"
//                 )}
//               >
//                 U
//               </button>
//             </div>

//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }