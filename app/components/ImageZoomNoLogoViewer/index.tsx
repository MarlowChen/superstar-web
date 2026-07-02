import React, { useState, useEffect } from "react";
import Image from "next/image";
import { HistoryIcon } from "../../icon/HistoryIcon";
import { DownloadIcon } from "../../icon/DownloadIcon";
import { LinkIcon } from "../../icon/LinkIcon";
import { ShareIcon } from "../../icon/ShareIcon";
import { showToast } from "../CustomToast";
import { useTranslations } from "next-intl";

interface ImageZoomViewerProps {
  modelName: string;
  prompt: string;
  images: {
    url: string;
    id: string;
    prompt?: string;
  }[];
  initialIndex: number;
  onClose: () => void;
}

const ArrowIcon = ({ className = "", wrapperClassName = "" }) => {
  return (
    <div className={`inline-block ${wrapperClassName}`}>
      <svg
        version="1.2"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 35 100"
        className={`w-full h-full transition-colors duration-300 ${className}`}
      >
        <path
          fillRule="evenodd"
          d="m33 50.4c0 5.1-1.6 9.4-4.9 12.9-7.3 7.9-14.7 15.8-22.1 23.7-0.3 0.3-0.7 0.7-1.1 1-1 0.8-2.4 0.7-3.4-0.1-0.9-0.9-1.1-2.2-0.5-3.4 0.2-0.4 0.6-0.7 0.9-1q10.8-11.6 21.7-23.2c5.4-5.9 5.4-13.2-0.1-19q-10.8-11.7-21.7-23.3c-0.7-0.7-1.2-1.4-1.2-2.4 0.1-1.1 0.7-2 1.7-2.4 1-0.4 2-0.3 2.8 0.5 1 1 2 2 2.9 3q10 10.7 20 21.4c3.3 3.5 4.9 7.7 5 12.3z"
        />
      </svg>
    </div>
  );
};

const ImageZoomViewer: React.FC<ImageZoomViewerProps> = ({
  modelName,
  prompt,
  images,
  initialIndex,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const t = useTranslations("share");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose]);

  // 複製文字的函數
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied successfully!");
    } catch (error) {
      console.error("Copy failed:", error);
      showToast("Copy failed, please try again later", true);
    }
  };

  const downloadImage = async (
    image: {
      url: string;
      id: string;
      prompt?: string;
    },
    index: number
  ) => {
    try {
      // 使用統一的檔案名稱格式，包含模型編號
      // 如果沒有模型名稱，使用 "unknown" 作為備用
      const imageModelName = modelName || "unknown";
      const imageId = image.id || `img-${index + 1}`;
      const { getDownloadFileName } = await import('@/utils/getDownloadFileName');
      const fileName = getDownloadFileName(imageModelName, imageId);
      
      // 使用改進的下載函數，iOS Safari 將顯示分享面板讓用戶保存到相簿
      const { downloadImage: downloadImageHelper } = await import('@/utils/downloadHelper');
      const result = await downloadImageHelper(image.url, fileName);
      
      if (result.success) {
        if (result.method === 'share') {
          showToast(t("imageSaveHint") || "請選擇「儲存圖片」保存到相簿");
        } else {
          showToast(t("downloadSuccess") || "圖片下載成功");
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error("Download failed:", error);
      showToast(t("downloadFailed") || "圖片下載失敗", true);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-0 md:p-20"
    >
      {/* 主要內容區塊，增加水平內距給箭頭按鈕 */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-2xl w-full bg-white rounded-2xl shadow-lg "
      >
        {/* 卡片容器 */}
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center space-x-2 w-full">
            <div className="flex items-center min-w-[64px] justify-start">
              <HistoryIcon
                className="w-full h-full fill-slate-800 stroke-gray-600 stroke-[4]"
                wrapperClassName="w-[28px] h-[16px]"
              />
              <span className="pl-2 text-custom-black stroke-gray-600 stroke-[4] font-bold">
                History
              </span>
            </div>
            <div className="w-full overflow-hidden">
              <div className="h-[33px] flex flex-row items-center justify-between bg-custom-white text-custom-black dark:bg-[#3a444f] gap-1.5 border border-[0.5px] border-custom-logo-purple dark:border-slate-700 dark:border-custom-white hover:border-custom-logo-purple-hover dark:hover:border-slate-700 p-1 -mx-1 sm:mx-0 transition-all duration-200 relative shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.035)] focus-within:shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.075)] hover:border-custom-logo-purple-hover dark:hover:border-slate-700 focus-within:border-custom-logo-purple dark:focus-within:border-slate-700 cursor-text z-10 rounded-xl">
                <div className="overflow-hidden whitespace-nowrap text-ellipsis flex-1">
                  {prompt}
                </div>
                <button
                  className="text-white/70 p-2 hover:text-white transition-colors flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(prompt);
                  }}
                >
                  <LinkIcon
                    className="fill-custom-black hover:fill-gray-600"
                    wrapperClassName="w-4 h-6"
                  />
                </button>
              </div>
            </div>
          </div>
          {/* <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button> */}
        </div>
        <div className="overflow-hidden px-8 md:px-24 ">
          {/* Image Container */}
          <div className="relative aspect-square">
            <Image
              src={images[currentIndex].url}
              alt={`Image ${currentIndex + 1}`}
              layout="fill"
              objectFit="cover"
              className="select-none"
            />
          </div>
        </div>
        <div className="flex flex-col items-center justify-between px-4 text-custom-black dark:text-custom-white">
          <div className="flex flex-rol w-full mb-1 mt-2  items-center justify-between">
            <div className="flex items-center">
              <ShareIcon
                className="fill-custom-logo-purple stroke-custom-logo-purple stroke-[2]  "
                wrapperClassName="w-[16px] h-[16px]"
              />
              <p className="pl-2 "> {modelName}</p>
            </div>
            <div>
              <button
                className="p-2"
                onClick={() => {
                  downloadImage(images[currentIndex], currentIndex);
                }}
              >
                <DownloadIcon
                  className="fill-custom-logo-purple hover:fill-custom-logo-purple-hover stroke-custom-logo-purple stroke-[2]  "
                  wrapperClassName="w-[16px] h-[16px]"
                />
              </button>
            </div>
          </div>
          <div className="bg-bg-200 text-text-300 -mx-1 mb-1 flex flex-row items-center gap-2 rounded-md p-2 text-xs">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 256 256"
              className="shrink-0"
            >
              <path d="M236.8,188.09L149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z"></path>
            </svg>
            <div>
              <p>
                AIerONE&apos;s creations may not be precise, sometimes even
                naughty, but they always inspire unexpected moments.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <button
          className="absolute p-2 left-2 md:left-6 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white transition-colors"
          onClick={() =>
            setCurrentIndex(
              (prev) => (prev - 1 + images.length) % images.length
            )
          }
        >
          <ArrowIcon
            className="fill-slate-800 hover:fill-blue-600"
            wrapperClassName="w-3 h-10 rotate-180" // 旋轉箭頭方向
          />
        </button>
        <button
          className="absolute p-2 right-2 md:right-6 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white transition-colors"
          onClick={() => setCurrentIndex((prev) => (prev + 1) % images.length)}
        >
          <ArrowIcon
            className="fill-slate-800 hover:fill-blue-600"
            wrapperClassName="w-3 h-10"
          />
        </button>
      </div>
    </div>
  );
};

export default ImageZoomViewer;
