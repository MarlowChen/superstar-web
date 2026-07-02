"use client";

import {
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
  X,
  Layers,
  Combine,
  ChevronLeft,
  ChevronRight,
  Download,
  ChevronDown,
  Image,
  Crop,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type LayerListItem = {
  id: string;
  name: string;
  visible: boolean;
  thumb?: string;
  locked?: boolean;
  type: string;
};

type CommonProps = {
  items: LayerListItem[];
  activeId: string | null;
  activeIds?: string[];
  onSelect: (id: string, shiftKey?: boolean) => void;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (next: LayerListItem[]) => void;
  onMerge?: (ids: string[]) => void;
  onDownloadLayer?: (id: string, type: "original" | "cropped") => void;
  onRename?: (id: string, newName: string) => void;
};

type SidebarProps = CommonProps & {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
};

type DrawerProps = CommonProps & {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

// 下載按鈕組件
function DownloadDropdown({
  itemId,
  onDownload,
}: {
  itemId: string;
  onDownload?: (id: string, type: "original" | "cropped") => void;
}) {
  const t = useTranslations("edited");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  useState(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 rounded hover:bg-custom-light-purple/50 transition-colors shrink-0 flex items-center gap-0.5"
        title={t("download_layer")}
        type="button"
      >
        <Download size={16} className="text-green-600" />
        <ChevronDown size={12} className="text-custom-black/40 dark:text-custom-white/40" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-custom-white dark:bg-[#1A2633] border border-custom-black/5 dark:border-white/10 rounded-lg shadow-xl py-1 min-w-[140px] text-custom-black dark:text-custom-white backdrop-blur-md">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload?.(itemId, "original");
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-custom-light-purple/30 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Image size={14} className="opacity-70"/>
            {t("original_size_image")}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload?.(itemId, "cropped");
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-custom-light-purple/30 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Crop size={14} className="opacity-70"/>
            {t("cropped_image")}
          </button>
        </div>
      )}
    </div>
  );
}

function List({
  items,
  activeId,
  activeIds = [],
  onSelect,
  onToggleVisible,
  onDelete,
  onReorder,
  onMerge,
  onDownloadLayer,
}: CommonProps) {
  const t = useTranslations("edited");
  const draggingIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const selectedIds =
    activeIds.length > 0 ? activeIds : activeId ? [activeId] : [];
  const hasMultiple = selectedIds.length > 1;

  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    const item = items[idx];
    if (item.locked) {
      e.preventDefault();
      return;
    }
    draggingIndex.current = idx;
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };

  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    if (draggingIndex.current == null) return;
    if (items[idx].locked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(idx);
  };

  const handleDragLeave = () => {
    setOverIndex(null);
  };

  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const fromIndex = draggingIndex.current;
    draggingIndex.current = null;
    setOverIndex(null);
    setIsDragging(false);

    if (fromIndex == null || fromIndex === idx) return;
    if (items[idx].locked) return;

    const newItems = [...items];
    const [draggedItem] = newItems.splice(fromIndex, 1);
    let targetIndex = idx;
    if (fromIndex > idx) targetIndex = idx;
    
    const bgIndex = newItems.findIndex((item) => item.locked);
    if (bgIndex !== -1 && targetIndex >= bgIndex) targetIndex = bgIndex;
    targetIndex = Math.max(0, Math.min(targetIndex, newItems.length));
    newItems.splice(targetIndex, 0, draggedItem);
    onReorder(newItems);
  };

  const handleDragEnd = () => {
    draggingIndex.current = null;
    setOverIndex(null);
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent, id: string) => {
    if (isDragging) return;
    const item = items.find((it) => it.id === id);
    if (!item) return;
    if (!item.visible) {
      e.preventDefault();
      return;
    }
    const multi = e.shiftKey || e.metaKey || e.ctrlKey;
    onSelect(id, multi);
  };

  const renderMergeButton = () => {
    if (!hasMultiple || !onMerge) return null;
    const mergableCount = selectedIds.filter((id) => {
      const item = items.find((it) => it.id === id);
      return item && !item.locked;
    }).length;
    if (mergableCount < 2) return null;

    return (
      <div className="px-3 py-3 border-b border-custom-black/5 dark:border-white/10">
        <button
          onClick={() => {
            const mergableIds = selectedIds.filter((id) => {
              const item = items.find((it) => it.id === id);
              return item && !item.locked;
            });
            const sorted = items
              .filter((item) => mergableIds.includes(item.id))
              .map((item) => item.id);
            onMerge(sorted);
          }}
          className="w-full px-3 py-2 rounded-lg bg-custom-logo-purple hover:bg-custom-logo-purple-hover text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-md active:scale-95"
        >
          <Combine size={16} />
          {t("merge_layers_count", { count: mergableCount })}
        </button>
      </div>
    );
  };

  return (
    <>
      {renderMergeButton()}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 && (
          <div className="text-xs text-custom-black/60 dark:text-custom-white/60 px-2 py-4 text-center">
            {t("no_layers_yet")}
          </div>
        )}
        {items.map((it, idx) => {
          const isSelected = selectedIds.includes(it.id);
          const isBeingDragged = draggingIndex.current === idx;

          return (
            <div
              key={it.id}
              draggable={!it.locked}
              onDragStart={handleDragStart(idx)}
              onDragOver={handleDragOver(idx)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(idx)}
              onDragEnd={handleDragEnd}
              onClick={(e) => handleClick(e, it.id)}
              // 🔥🔥 視覺優化核心 🔥🔥
              // 背景層(容器)是淺紫，所以這裡的卡片必須是「白色 (bg-custom-white)」才能跳出來。
              // 1. 卡片背景：bg-custom-white (白) / dark:bg-gray-800
              // 2. 文字顏色：text-custom-black (深色) / dark:text-custom-white (白色)
              // 3. 選中狀態：加上明顯的 Logo 紫邊框 ring-2，背景稍微帶一點點紫
              // 4. 陰影：shadow-sm 讓卡片立體，避免跟背景融合
              className={`group flex items-center gap-2 p-2.5 rounded-xl text-sm transition-all
                ${
                  !it.visible
                    ? "opacity-60 bg-custom-gray/50 dark:bg-gray-900/50 border border-transparent text-custom-black/50 dark:text-custom-white/50 cursor-default grayscale"
                    : isSelected
                    ? "bg-white dark:bg-gray-800 ring-2 ring-custom-logo-purple text-custom-logo-purple font-medium cursor-pointer shadow-md z-10"
                    : "bg-custom-white dark:bg-gray-800 border border-transparent hover:border-custom-logo-purple/30 text-custom-black dark:text-custom-white cursor-pointer shadow-sm hover:shadow-md"
                }
                ${
                  overIndex === idx && !isBeingDragged
                    ? "ring-2 ring-custom-logo-purple ring-offset-2 ring-offset-custom-light-purple dark:ring-offset-[#23292f]"
                    : ""
                }
                ${isBeingDragged ? "opacity-50 scale-95 shadow-none" : ""}
                ${it.locked ? "opacity-90 cursor-not-allowed bg-custom-gray/20 dark:bg-gray-900/30 border-dashed border-custom-black/10" : "cursor-move"}
              `}
              title={
                it.locked ? t("background_layer") : it.visible ? t("layer") : t("layer_hidden")
              }
            >
              <GripVertical
                className={`shrink-0 text-custom-black/30 dark:text-custom-white/30 ${
                  it.locked ? "invisible" : "opacity-40 group-hover:opacity-100 transition-opacity"
                }`}
                size={14}
              />
              {it.thumb ? (
                <img
                  src={it.thumb}
                  alt=""
                  // 縮圖加上淡框
                  className="w-9 h-9 rounded-md object-cover border border-custom-black/10 dark:border-white/10 bg-white"
                />
              ) : (
                <div className="w-9 h-9 rounded-md bg-custom-gray/50 border border-custom-black/5 dark:border-white/5" />
              )}
              <div className="flex-1 truncate px-1">
                {it.name}
                {it.locked ? ` (${t("background")})` : ""}
              </div>
              
              {/* 操作按鈕 */}
              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                {!it.locked && onDownloadLayer && (
                  <DownloadDropdown
                    itemId={it.id}
                    onDownload={onDownloadLayer}
                  />
                )}

                <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const willBeHidden = it.visible;
                      const isCurrentlySelected = selectedIds.includes(it.id);
                      if (willBeHidden && isCurrentlySelected) {
                        if (hasMultiple) {
                          const newSelectedIds = selectedIds.filter(
                            (id) => id !== it.id
                          );
                          if (newSelectedIds.length > 0) {
                            onSelect(newSelectedIds[0], false);
                          } else {
                            onSelect("", false);
                          }
                        } else {
                          onSelect("", false);
                        }
                      }
                      onToggleVisible(it.id);
                    }}
                    className="p-1.5 rounded hover:bg-custom-light-purple/50 transition-colors shrink-0"
                    title={it.visible ? t("hide_layer") : t("show_layer")}
                    type="button"
                >
                  {it.visible ? (
                    <Eye size={16} className={isSelected ? "text-custom-logo-purple" : "text-custom-black/60 dark:text-custom-white/60"} />
                  ) : (
                    <EyeOff size={16} className="text-custom-black/30 dark:text-custom-white/30" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!it.locked) onDelete(it.id);
                  }}
                  className={`p-1.5 rounded transition-colors ${
                    it.locked
                      ? "opacity-0 cursor-default"
                      : "hover:bg-red-50 dark:hover:bg-red-900/20 text-custom-black/40 dark:text-custom-white/40 hover:text-red-500"
                  }`}
                  title={it.locked ? "" : t("delete")}
                  disabled={!!it.locked}
                >
                  {!it.locked && <Trash2 size={16} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * Desktop Sidebar
 */
export function LayersSidebar({
  isCollapsed,
  setIsCollapsed,
  ...rest
}: SidebarProps) {
  const t = useTranslations("edited");
  const selectedCount = rest.activeIds?.length || (rest.activeId ? 1 : 0);

  const toggleCollapsed = () => setIsCollapsed(!isCollapsed);

  return (
    <aside
      // 🔥🔥 重點：容器使用您指定的顏色 🔥🔥
      // bg-custom-light-purple (淺色模式淺紫) / dark:bg-[#23292f87] (深色模式深灰藍)
      // 文字顏色：text-custom-black / dark:text-custom-white
      className={`hidden lg:flex flex-col border-l border-custom-black/5 dark:border-white/5 
      bg-custom-light-purple dark:bg-[#23292f87] backdrop-blur-xl transition-all duration-300 ease-in-out text-custom-black dark:text-custom-white z-20 ${
        isCollapsed ? "w-[60px]" : "w-[280px]"
      }`}
    >
      {isCollapsed && (
        <div className="flex flex-col items-center py-4 space-y-4">
          <button
            onClick={toggleCollapsed}
            className="p-2 rounded-xl hover:bg-custom-white/30 transition-colors shadow-sm border border-transparent hover:border-custom-white/20"
            title={t("expand_layers_panel")}
          >
            <ChevronLeft size={20} className="opacity-60" />
          </button>
          <div className="flex flex-col items-center gap-1">
            <Layers size={20} className="text-custom-black/60 dark:text-custom-white/60" />
            {selectedCount > 0 && (
              <span className="text-[10px] text-white bg-custom-logo-purple px-1.5 py-0.5 rounded-full font-bold">
                {selectedCount}
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className={`flex-1 min-w-0 ${isCollapsed ? "hidden" : "flex flex-col"}`}
      >
        <div className="px-4 py-3 border-b border-custom-black/5 dark:border-white/5 flex items-center justify-between">
          <div className="text-sm font-semibold flex items-center gap-2 opacity-90">
            <Layers size={16} className="text-custom-logo-purple" /> 
            {t("layers")}
            {selectedCount > 1 && (
              <span className="text-xs text-custom-logo-purple bg-custom-logo-purple/10 px-2 py-0.5 rounded-full font-medium">
                {selectedCount}
              </span>
            )}
          </div>
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded hover:bg-custom-white/50 transition-colors"
            title={t("collapse_panel")}
          >
            <ChevronRight size={16} className="opacity-60" />
          </button>
        </div>
        
        {/* List 容器背景透明，讓 custom-light-purple 透出來 */}
        <div className="flex-1 flex flex-col min-h-0">
            <List {...rest} />
        </div>
        
        <div className="text-[10px] text-custom-black/40 dark:text-custom-white/40 px-4 py-3 border-t border-custom-black/5 dark:border-white/5 space-y-1">
          <div className="flex items-center gap-1">
            <GripVertical size={10}/> {t("drag_grip_to_reorder")}
          </div>
          <div className="text-custom-logo-purple/80 font-medium">
            {t("hold_shift_cmd_ctrl_to_multiselect")}
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * Mobile Drawer
 */
export function LayersDrawer({ isOpen, setIsOpen, ...rest }: DrawerProps) {
  const t = useTranslations("edited");
  const selectedCount = rest.activeIds?.length || (rest.activeId ? 1 : 0);

  return (
    <div
      className={`lg:hidden fixed inset-0 z-[60] ${
        isOpen ? "" : "pointer-events-none"
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/20 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => setIsOpen(false)}
      />
      
      <div
        // 🔥🔥 重點：容器使用您指定的顏色 🔥🔥
        className={`absolute right-0 top-0 bottom-0 w-[85%] max-w-[320px] 
        bg-custom-light-purple dark:bg-[#23292f87] border-l border-custom-black/5 dark:border-white/5 
        text-custom-black dark:text-custom-white transition-transform duration-300 ease-in-out flex flex-col shadow-2xl
        ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="px-4 py-4 border-b border-custom-black/5 dark:border-white/5 flex items-center justify-between">
          <div className="text-base font-semibold flex items-center gap-2">
            <Layers size={18} className="text-custom-logo-purple" />
            {t("layers")}
            {selectedCount > 1 && (
              <span className="text-xs text-white bg-custom-logo-purple px-2 py-0.5 rounded-full">
                {selectedCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-full hover:bg-custom-white/50 transition-colors bg-custom-white/30 dark:bg-gray-800 shadow-sm border border-custom-black/5 dark:border-white/5"
            title={t("close")}
          >
            <X size={18} className="opacity-70" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col min-h-0">
            <List {...rest} />
        </div>

        <div className="text-[10px] text-custom-black/40 dark:text-custom-white/40 px-4 py-4 border-t border-custom-black/5 dark:border-white/5 space-y-1 safe-area-bottom">
          <div>{t("drag_to_reorder_layers")}</div>
          <div className="text-custom-logo-purple font-medium">
            {t("hold_shift_cmd_ctrl_to_multiselect")}
          </div>
        </div>
      </div>
    </div>
  );
}