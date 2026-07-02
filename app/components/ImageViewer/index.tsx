import React from "react";

interface ImageViewerProps {
  title: string,
  children: React.ReactNode;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  openHistory: () => void;
  publish: () => void;
  messageTimestamp: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  title,
  children,
  isCollapsed,
  setIsCollapsed,
  openHistory,
  messageTimestamp,
}) => {
  return (
    <div className="bg-custom-light-purple dark:bg-[#3a444f] flex h-full w-[calc(100%-.5rem)] flex-col text-[#2C3E50] dark:text-custom-white text-sm font-mono">
      {/* Header */}
      <div className="border-[#2C3E50] sticky flex items-center gap-1 border-b px-2 py-2">
        <div className="flex flex-auto items-center overflow-hidden">
          <button
            onClick={openHistory}
            className="inline-flex items-center justify-center relative shrink-0 h-8 w-8 rounded-md active:scale-95 text-[#2C3E50] dark:text-custom-white transition-all hover:bg-[#E6E8EB] dark:hover:bg-[#2C3E50] hover:text-[#5944FF] dark:hover:text-[#8F7FFF]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path>
            </svg>
          </button>
          <h3 className="text-[#2C3E50] dark:text-custom-white truncate pl-1 text-sm font-serif">
            {title}
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
      <div className="md:relative flex w-full flex-1 overflow-x-auto">
        {children}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[#6C7A89] dark:text-[#8F7FFF] py-2 px-2 border-t border-[#2C3E50]">
        <div >
          <p className="text-sm text-[#6C7A89] dark:text-[#8F7FFF]">
            Created At: {new Date(messageTimestamp).toLocaleString()}
          </p>
          {/* <div className="px-3">Last edited 1 天前</div> */}
        </div>
        <div className="flex flex-1 items-center justify-end">
          {/* <button className="inline-flex items-center justify-center relative shrink-0 h-8 w-8 rounded-md active:scale-95 text-[#2C3E50] dark:text-custom-white transition-all hover:bg-[#E6E8EB] dark:hover:bg-[#2C3E50] hover:text-[#5944FF] dark:hover:text-[#8F7FFF]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path d="M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm72,184H56V48H82.75A47.93,47.93,0,0,0,80,64v8a8,8,0,0,0,8,8h80a8,8,0,0,0,8-8V64a47.93,47.93,0,0,0-2.75-16H200Z"></path>
            </svg>
          </button> */}
          <button className="inline-flex items-center justify-center relative shrink-0 h-8 w-8 rounded-md active:scale-95 text-[#2C3E50] dark:text-custom-white transition-all hover:bg-[#E6E8EB] dark:hover:bg-[#2C3E50] hover:text-[#5944FF] dark:hover:text-[#8F7FFF]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"></path>
            </svg>
          </button>
          {/* <button
            onClick={publish}
            className="inline-flex items-center justify-center relative shrink-0 h-8 rounded-md px-3 text-xs min-w-[4rem] active:scale-[0.985] bg-gradient-to-r from-[#E6E8EB]/10 to-[#E6E8EB]/30 dark:from-[#2C3E50]/10 dark:to-[#2C3E50]/30 border-[0.5px] border-[#2C3E50] text-[#2C3E50] dark:text-custom-white transition-colors hover:text-[#5944FF] dark:hover:text-[#8F7FFF] hover:bg-[#E6E8EB]/60 dark:hover:bg-[#2C3E50]/60"
          >
            Publish
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;