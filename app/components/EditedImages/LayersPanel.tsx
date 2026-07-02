"use client";

import { Eye, EyeOff, GripVertical, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

export interface LayerItem {
  id: string;
  name: string;
  visible: boolean;
}

interface LayersPanelProps {
  open: boolean;
  onClose: () => void;

  layers: LayerItem[];            // 面板顯示為「由上到下 = 由上層到下層」
  selectedId: string | null;

  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (next: LayerItem[]) => void; // 拖曳後的新順序（仍是上到下）
}

export default function LayersPanel({
  open, onClose, layers, selectedId,
  onSelect, onToggleVisibility, onDelete, onReorder
}: LayersPanelProps) {
  const t = useTranslations("edited");
  // 簡易 HTML5 Drag & Drop
  const [dragId, setDragId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!dragId || dragId === overId) { setDragId(null); return; }
    const srcIdx = layers.findIndex(l => l.id === dragId);
    const dstIdx = layers.findIndex(l => l.id === overId);
    if (srcIdx < 0 || dstIdx < 0) { setDragId(null); return; }

    const next = [...layers];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(dstIdx, 0, moved);
    onReorder(next);
    setDragId(null);
  };

  const cls = (...s: (string | false | undefined)[]) => s.filter(Boolean).join(" ");

  const body = useMemo(() => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-custom-gray flex items-center justify-between text-custom-black dark:text-custom-white">
        <div className="text-sm font-semibold">{t("layers")}</div>
        <button 
          onClick={onClose} 
          className="lg:hidden p-1.5 rounded hover:bg-custom-gray text-custom-black dark:text-custom-white"
        >
          <X size={16}/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {layers.length === 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-4">
            {t("no_layers_yet")}
          </div>
        )}

        {/* 上方是最上層 */}
        <ul className="space-y-1">
          {layers.map((l) => {
            const isActive = l.id === selectedId;
            return (
              <li key={l.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, l.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, l.id)}
                  className={cls(
                    "flex items-center gap-2 p-2 rounded-md border transition-colors cursor-grab",
                    isActive
                      // Active state: 使用 custom-logo-purple 相關色系
                      ? "bg-custom-light-purple/30 dark:bg-custom-light-purple/10 border-custom-logo-purple"
                      // Inactive state: 使用 custom-white/custom-gray
                      : "bg-custom-white dark:bg-custom-white-dark border-custom-gray hover:bg-custom-gray"
                  )}
              >
                <GripVertical size={16} className="text-gray-400 flex-shrink-0" />
                <button
                  onClick={() => onSelect(l.id)}
                  className={cls(
                    "flex-1 text-left text-sm truncate",
                    isActive 
                      ? "text-custom-logo-purple font-medium" 
                      : "text-custom-black dark:text-custom-white"
                  )}
                  title={l.name}
                >
                  {l.name}
                </button>
                <button
                  onClick={() => onToggleVisibility(l.id)}
                  className="p-1 rounded hover:bg-custom-gray text-custom-black dark:text-custom-white"
                  title={l.visible ? t("hide_layer") : t("show_layer")}
                >
                  {l.visible ? <Eye size={16}/> : <EyeOff size={16}/>}
                </button>
                <button
                  onClick={() => onDelete(l.id)}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                  title={t("delete_layer")}
                >
                  <Trash2 size={16}/>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-3 py-3 text-[11px] text-gray-500 dark:text-gray-400 border-t border-custom-gray">
        {t("layers_panel_hint")}
      </div>
    </div>
  ), [layers, selectedId, onClose, onDelete, onSelect, onToggleVisibility]);

  return (
    <aside
      className={cls(
        "relative bg-custom-white dark:bg-custom-white-dark border-l border-custom-gray transition-all",
        "w-80 max-w-full hidden lg:block"
      )}
      style={{ display: open ? undefined : "none" }}
    >
      {body}
    </aside>
  );
}