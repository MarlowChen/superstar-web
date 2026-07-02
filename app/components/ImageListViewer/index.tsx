import React from "react";

interface ImageViewerProps {
  children: React.ReactNode;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}

const ImageListViewer: React.FC<ImageViewerProps> = ({
  children,
  isCollapsed,
  setIsCollapsed,
}) => {
  return (
    <div className="bg-custom-light-purple dark:bg-bg-[#3a444f] flex h-full w-[calc(100%-.5rem)] flex-col text-[#2C3E50] dark:text-custom-white text-sm font-mono">
      {/* Header */}
      <div className="border-[#2C3E50] sticky flex items-center gap-1 border-b px-2 py-2">
        <div className="flex flex-auto items-center overflow-hidden">
          <h3 className="text-[#2C3E50] dark:text-custom-white truncate pl-1 text-sm font-serif">
            History
          </h3>
        </div>
        <div className="flex shrink-0 flex-grow items-center justify-end gap-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="inline-flex items-center justify-center relative shrink-0 h-8 w-8 rounded-md active:scale-95 text-[#2C3E50] dark:text-custom-white transition-all hover:bg-[#E6E8EB] dark:hover:bg-[#2C3E50] hover:text-[#5944FF] dark:hover:text-[#8F7FFF]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="relative flex w-full flex-1 overflow-x-auto overflow-y-scroll">
        {children}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[#6C7A89] dark:text-[#8F7FFF] py-2 px-2 border-t border-[#2C3E50]"></div>
    </div>
  );
};

export default ImageListViewer;