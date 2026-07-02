import { Eraser, Trash2, Move, User, X } from "lucide-react";
import { EditorTool } from "./ImageEditor";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

interface MobileEditorSidebarProps {
  isOpen: boolean;
  toggleSidebar: (e: React.MouseEvent<HTMLButtonElement> | null) => void;
  selectedTool: EditorTool;
  onToolSelect: (tool: EditorTool) => void;
}

const MobileEditorSidebar: React.FC<MobileEditorSidebarProps> = ({
  isOpen,
  toggleSidebar,
  selectedTool,
  onToolSelect,
}) => {
  const t = useTranslations("edited");

  const EDITOR_TOOLS = useMemo(() => [
    { id: "background-removal" as EditorTool, name: t("remove_background"), icon: Trash2, description: t("remove_background_one_click"), color: "from-blue-500 to-cyan-500", shortcut: "B" },
    // { id: "layer-separation" as EditorTool, name: t("layer_separation"), icon: Layers, description: t("auto_separate_layers"), color: "from-purple-500 to-pink-500", shortcut: "L" },
    { id: "eraser" as EditorTool, name: t("smart_eraser"), icon: Eraser, description: t("remove_or_replace_items"), color: "from-orange-500 to-red-500", shortcut: "E" },
    { id: "pose-control" as EditorTool, name: t("pose_control"), icon: User, description: t("control_character_pose_direction"), color: "from-green-500 to-emerald-500", shortcut: "P" },
    { id: "object-placement" as EditorTool, name: t("object_placement"), icon: Move, description: t("move_and_merge_items"), color: "from-indigo-500 to-blue-500", shortcut: "O" },
  ], [t]);
  const NavItem = ({ tool }: { tool: typeof EDITOR_TOOLS[0] }) => {
    const isActive = selectedTool === tool.id;
    const Icon = tool.icon;

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToolSelect(tool.id);
        }}
        className={`
          flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-300 overflow-hidden
          ${isActive 
            ? `bg-gradient-to-br ${tool.color} text-white shadow-lg` 
            : "text-[#2C3E50] dark:text-white group hover:bg-gray-100 dark:hover:bg-gray-700"
          }
        `}
      >
        <span className={`
          flex mr-4
          ${isActive 
            ? "fill-white stroke-white" 
            : "fill-custom-black stroke-custom-black stroke-[2] group-hover:fill-[#5944FF] group-hover:stroke-[#5944FF] dark:fill-white dark:stroke-white dark:group-hover:fill-[#8F7FFF] dark:group-hover:stroke-[#8F7FFF]"
          }
        `}>
          <div className="relative">
            <Icon size={20} />
            <span className={`
              absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center
              ${isActive ? "bg-white text-gray-800" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}
            `}>
              {tool.shortcut}
            </span>
          </div>
        </span>
        <span className="w-auto opacity-100 transition-all duration-300 whitespace-nowrap">
          <div className={`font-medium ${isActive ? "text-white" : "group-hover:text-[#5944FF] dark:group-hover:text-[#8F7FFF]"}`}>
            {tool.name}
          </div>
          <div className={`text-xs ${isActive ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
            {tool.description}
          </div>
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Backdrop - 只在打開時顯示 */}
      {isOpen && (
        <div
          className="block lg:hidden fixed inset-0 bg-black/30 z-10 transition-opacity duration-300"
          onClick={(e) => {
            e.stopPropagation();
            toggleSidebar;
          }}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`block lg:hidden fixed bottom-0 left-0 top-0 z-20 w-72 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div className="bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 absolute inset-0 overflow-hidden shadow-2xl" />

        {/* Content */}
        <div className="flex h-full flex-col gap-2 relative z-10 p-3">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white">{t("edit_tools")}</h3>
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors pointer-events-auto"
            >
              <X size={20} className="text-gray-900 dark:text-white" />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto px-2 space-y-2">
            {EDITOR_TOOLS.map((tool) => <NavItem key={tool.id} tool={tool} />)}
          </div>
        </div>
      </nav>
    </>
  );
};

export default MobileEditorSidebar;