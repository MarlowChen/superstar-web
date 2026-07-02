"use client";
import React, { useEffect, ReactNode, forwardRef } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

interface DrawerSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  namespace?: string; // 用於決定使用哪個翻譯命名空間
}

const DrawerSelector = forwardRef<
  HTMLDivElement,
  DrawerSelectorProps
>(({ isOpen, onClose, children, title, namespace = "models" }, ref) => {
  const t = useTranslations(namespace);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <>
      {/* 背景遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Drawer 容器 */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-custom-white dark:bg-[#3a444f] rounded-t-lg overflow-hidden transition-transform duration-300 ease-in-out transform ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "80vh" }}
      >
        {/* 標題列 */}
        <div className="p-4 border-b border-[0.5px] border-custom-logo-purple dark:border-slate-700 flex justify-between items-center bg-custom-white dark:bg-[#3a444f] sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-gray-500 dark:text-gray-300">
            {title || t("selectModel")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-300 hover:text-custom-logo-purple dark:hover:text-custom-logo-purple-dark transition-colors duration-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 內容滾動區域 */}
        <div
          ref={ref}
          className="bg-custom-gray dark:bg-custom-gray-dark overflow-y-auto"
          style={{
            height: "calc(80vh - 73px)", // 80vh - 標題列高度(73px)
            maxHeight: "calc(80vh - 73px)",
          }}
        >
          {/* 內容包裝器 - 添加適當的 padding */}
          <div className="px-4 py-6 pb-20">{children}</div>
        </div>
      </div>
    </>
  );
});

DrawerSelector.displayName = "DrawerSelector";
export default DrawerSelector; 
 
 