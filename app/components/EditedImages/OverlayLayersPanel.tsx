"use client";

import { Eye, EyeOff, Trash2, GripVertical, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

export type OverlayListItem = {
  id: string;
  name: string;
  visible: boolean;
  thumb?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;

  items: OverlayListItem[];     // 面板顯示順序：上→下 = 視覺 上層→下層
  activeId: string | null;

  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (next: OverlayListItem[]) => void;
}

export default function OverlayLayersPanel({
  open, onClose,
  items, activeId,
  onSelect, onToggleVisible, onDelete, onReorder,
}: Props) {
  const t = useTranslations("edited");
  const draggingIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    draggingIndex.current = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };
  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setOverIndex(idx);
  };
  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = draggingIndex.current;
    draggingIndex.current = null;
    setOverIndex(null);
    if (from == null || from === idx) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    onReorder(next);
  };
  const handleDragEnd = () => { draggingIndex.current = null; setOverIndex(null); };

  return (
    <aside
      className={`absolute right-0 top-0 bottom-0 w-[260px] bg-white/95 dark:bg-gray-900/95 border-l border-gray-200 dark:border-gray-800 backdrop-blur-xl
        transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
      aria-label="Layers"
    >
      <div className="h-full flex flex-col">
        <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="text-sm font-semibold">{t("layers")}</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={16}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {items.length === 0 && (
            <div className="text-xs text-gray-500 px-2 py-4">
              {t("no_overlay_layers_yet")}
            </div>
          )}
          {items.map((it, idx) => (
            <div
              key={it.id}
              draggable
              onDragStart={handleDragStart(idx)}
              onDragOver={handleDragOver(idx)}
              onDrop={handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={`group flex items-center gap-2 p-2 rounded-lg border text-sm cursor-grab
                ${activeId === it.id ? "border-purple-300 bg-purple-50/60 dark:bg-purple-900/20" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"}
                ${overIndex === idx ? "ring-2 ring-purple-400" : ""}
              `}
              onClick={() => onSelect(it.id)}
            >
              <GripVertical className="shrink-0 opacity-60" size={16} />
              {it.thumb ? (
                <img src={it.thumb} alt="" className="w-8 h-8 rounded object-cover border border-gray-200 dark:border-gray-800" />
              ) : (
                <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800" />
              )}
              <div className="flex-1 truncate">{it.name}</div>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleVisible(it.id); }}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                title={it.visible ? t("hide_layer") : t("show_layer")}
              >
                {it.visible ? <Eye size={16}/> : <EyeOff size={16}/>}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(it.id); }}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                title={t("delete")}
              >
                <Trash2 size={16}/>
              </button>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-gray-500 dark:text-gray-400 px-3 py-2 border-t border-gray-200 dark:border-gray-800">
          {t("overlay_layers_hint")}
        </div>
      </div>
    </aside>
  );
}
