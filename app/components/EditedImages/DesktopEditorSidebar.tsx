import { Eraser, Trash2, Move, User, PanelLeftClose, PanelLeftOpen, Paintbrush } from "lucide-react";
import { EditorTool } from "./ImageEditor";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

interface DesktopEditorSidebarProps {
  isCollapsed: boolean;
  toggleSidebar: (e: React.MouseEvent<HTMLButtonElement>) => void;
  selectedTool: EditorTool;
  onToolSelect: (tool: EditorTool) => void;
}

const DesktopEditorSidebar: React.FC<DesktopEditorSidebarProps> = ({
  isCollapsed,
  toggleSidebar,
  selectedTool,
  onToolSelect,
}) => {
  const t = useTranslations("edited");

  const EDITOR_TOOLS = useMemo(() => [
    { id: "background-removal" as EditorTool, name: t("remove_background"), icon: Trash2, description: t("remove_background_one_click"), color: "from-blue-500 to-cyan-500", shortcut: "B" },
    // { id: "layer-separation" as EditorTool, name: t("layer_separation"), icon: Layers, description: t("auto_separate_layers"), color: "from-purple-500 to-pink-500", shortcut: "L" },
    { id: "eraser" as EditorTool, name: t("smart_eraser"), icon: Eraser, description: t("remove_or_replace_items"), color: "from-orange-500 to-red-500", shortcut: "E" },
    { id: "brush" as EditorTool, name: t("brush_tool"), icon: Paintbrush, description: t("draw_on_layer"), color: "from-pink-500 to-purple-500", shortcut: "D" },
    { id: "pose-control" as EditorTool, name: t("pose_control"), icon: User, description: t("control_character_pose_direction"), color: "from-green-500 to-emerald-500", shortcut: "P" },
    { id: "object-placement" as EditorTool, name: t("object_placement"), icon: Move, description: t("move_and_merge_items"), color: "from-indigo-500 to-blue-500", shortcut: "O" },
  ], [t]);
  const NavItem = ({ tool }: { tool: typeof EDITOR_TOOLS[0] }) => {
    const isActive = selectedTool === tool.id;
    const Icon = tool.icon;

    return (
      <button
        onClick={() => onToolSelect(tool.id)}
        className={clsx(
          "flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-300 ease-in-out overflow-hidden w-full",
          isActive
            ? `bg-gradient-to-br ${tool.color} text-white shadow-lg`
            : "text-[#2C3E50] dark:text-white group hover:bg-gray-100 dark:hover:bg-gray-700"
        )}
      >
        <span
          className={clsx(
            "flex transition-all duration-300 ease-in-out",
            isCollapsed ? "mr-0" : "mr-4",
            isActive
              ? "fill-white stroke-white"
              : "fill-custom-black stroke-custom-black stroke-[2] group-hover:fill-[#5944FF] group-hover:stroke-[#5944FF] dark:fill-white dark:stroke-white dark:group-hover:fill-[#8F7FFF] dark:group-hover:stroke-[#8F7FFF]"
          )}
        >
          <div className="relative">
            <Icon size={20} />
            <span
              className={clsx(
                "absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center",
                isActive ? "bg-white text-gray-800" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              )}
            >
              {tool.shortcut}
            </span>
          </div>
        </span>
        <span
          className={clsx(
            "transition-all duration-300 ease-in-out whitespace-nowrap text-left",
            isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          )}
        >
          <div className={clsx("font-medium", isActive ? "text-white" : "group-hover:text-[#5944FF] dark:group-hover:text-[#8F7FFF]")}>{tool.name}</div>
          <div className={clsx("text-xs", isActive ? "text-white/80" : "text-gray-500 dark:text-gray-400")}>{tool.description}</div>
        </span>
      </button>
    );
  };

  return (
    <aside
      className={clsx(
        "hidden lg:flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 transition-all duration-300 ease-in-out flex-shrink-0",
        isCollapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* TOP BAR with collapse control only */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur border-b border-gray-200/60 dark:border-gray-800/60">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
            aria-label={isCollapsed ? t("expand_sidebar") : t("collapse_sidebar")}
          >
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </div>

      {/* TOOL LIST */}
      <div className="p-3 flex-1 overflow-y-auto space-y-2">
        {EDITOR_TOOLS.map((tool) => (
          <NavItem key={tool.id} tool={tool} />
        ))}
      </div>
    </aside>
  );
};

export default DesktopEditorSidebar;
