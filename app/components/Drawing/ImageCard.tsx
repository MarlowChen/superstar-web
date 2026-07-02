"use client";
import { JSX } from "react";
import { ImageCardProps } from "./types";

export default function ImageCard({
  image,
  onClick,
}: ImageCardProps): JSX.Element {


  return (
    <div className="group w-full flex flex-col bg-custom-white dark:bg-[#3a444f] border border-[0.5px] border-custom-logo-blue dark:border-slate-700 dark:border-custom-white hover:border-custom-logo-blue-hover dark:hover:border-slate-700 -mx-1 sm:mx-0 transition-all duration-200 relative shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.035)] hover:shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.075)] hover:border-custom-logo-blue-hover border-slate-700 focus-within:border-custom-logo-blue dark:focus-within:border-slate-700 z-10 rounded-2xl overflow-hidden">
      <div className="relative aspect-square w-full">
        {/* 使用空div作為圖片容器，設置背景圖片方式顯示 */}
        <div
          className="w-full h-full bg-cover bg-center cursor-pointer transition-transform duration-300 group-hover:scale-105"
          style={{
            backgroundImage: `url(${image.url})`,
            animation: "fadeIn 0.5s forwards",
          }}
          onClick={onClick}
        />

        {/* 加載中的效果 */}
        {!image.url && (
          <div className="absolute inset-0 flex items-center justify-center bg-custom-light-blue dark:bg-gray-700">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-custom-logo-blue" />
          </div>
        )}
      </div>
    </div>
  );
}