"use client";

import React from "react";

interface RightSidePanelProps {
  type: "history" | "image" | null;
  children: React.ReactNode;
  isCollapsed: boolean;
  zoomImage: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  isHistoryOpen: boolean;
  setIsHistoryOpen: (isHistoryOpen: boolean) => void;
}

const RightSidePanel: React.FC<RightSidePanelProps> = ({
  type,
  children,
  isCollapsed,
  zoomImage,
}) => {
  const getParentPanelWidthClass = () => {
    if (!isCollapsed) return "md:w-0";
    if (type === "history") return " lg:w-[calc(30vw-2.5rem)]";
    if (zoomImage) return "";
    return "lg:w-[calc(40vw-2.5rem)]";
  };
  const getPanelWidthClass = () => {
    if (!isCollapsed) return "md:w-0";
    if (type === "history") return "w-full md:w-[calc(30vw-2.5rem)]";
    if (zoomImage) return "w-full";
    return "w-full md:w-[calc(40vw-2.5rem)]";
  };

  const getFrameStyle = () => {
    if (zoomImage) return "w-full";
    return "w-[92.5%] ml-10";
  };

  return (
    <div
      className={`transition-all duration-300 ease-in-out ${getParentPanelWidthClass()}`}
    >
      <div className="transition-[width] lg:w-[calc(50vw-2rem)]"></div>
      <div
        className={`
          fixed bottom-0 md:top-0 flex flex-col h-full 
          transition-all duration-300 ease-in-out z-[5] right-0 
          ${
            isCollapsed ? "pointer-events-auto" : "pointer-events-none w-full"
          } 
          
          ${zoomImage ? "pt-0 z-[999]" : "pt-16 md:pb-4  md:pr-1"} 
          ${getPanelWidthClass()}
        `}
        style={{ marginRight: !zoomImage ? "15px" : "" }}
      >
        <div
          className={`bg-custom-white dark:bg-[#1A2633] ${getFrameStyle()} border-0.5 border-[#2C3E50] flex-1 overflow-hidden rounded-xl shadow-lg transition-all duration-300 ease-in-out 
                  ${
                    isCollapsed
                      ? "translate-y-0 md:translate-x-0 md:translate-y-0"
                      : "translate-y-full md:translate-y-0 md:translate-x-full"
                  }
            `}
        >
          <div className="flex h-full flex-col">
            <div className="relative bg-custom-white dark:bg-[#3a444f] flex h-full flex-col">
              <div className="hidden border-[#2C3E50] sticky flex items-center gap-1 px-2 py-2">
                {/* 這裡可以添加面板的標題或控制項 */}
              </div>
              <div className="md:relative flex w-full flex-1 overflow-hidden">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightSidePanel;
