"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import Image from "next/image";

export interface BannerItem {
  id: string;
  // 新增 'grid-layout-reverse' 類型
  type?: 'default' | 'grid-layout' | 'grid-layout-reverse';
  imageUrl?: string;
  gridImages?: string[]; // 用於 Grid 佈局的圖片陣列
  title?: string;
  subtitle?: string | string[];
  buttonText?: string;
  link?: string;
  onClick?: () => void;
  bgColor?: string;
  // 新增：允許自定義文字顏色 (適應淺色背景)
  textColor?: string; 
}

interface BannerCarouselProps {
  items: BannerItem[];
  autoplayInterval?: number;
  showNavigation?: boolean;
  showIndicators?: boolean;
  className?: string;
}

const BannerCarousel: React.FC<BannerCarouselProps> = ({
  items,
  autoplayInterval = 5000,
  showNavigation = true,
  showIndicators = true,
  className = "",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (items.length <= 1 || isHovered) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
    }, autoplayInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [items.length, autoplayInterval, isHovered]);

  const goToNext = () => setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
  const goToPrevious = () => setCurrentIndex((prevIndex) => (prevIndex - 1 + items.length) % items.length);
  const goToSlide = (index: number) => setCurrentIndex(index);

  if (!items || items.length === 0) return null;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl shadow-2xl ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 嚴格執行指定尺寸 */}
      <div className="relative w-full h-[280px] md:h-[380px] lg:h-[450px]">
        {items.map((item, index) => {
          const isActive = index === currentIndex;
          // 預設文字顏色為白色，若有指定則使用指定顏色
          const textColorClass = item.textColor ? `text-[${item.textColor}]` : 'text-white';
          // const subtitleColorClass = item.textColor ? `text-[${item.textColor}]/80` : 'text-white/90 md:text-gray-400';

          return (
            <div
              key={item.id}
              className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
              style={{ 
                pointerEvents: isActive ? 'auto' : 'none',
                backgroundColor: item.bgColor || 'transparent'
              }}
            >
              {/* =========================================================
                  模式 A: Grid Layout Reverse (左圖右文 - 新增)
                 ========================================================= */}
              {item.type === 'grid-layout-reverse' && item.gridImages && item.gridImages.length >= 3 ? (
                 <div className="w-full h-full block md:flex md:flex-row">
                    {/* 手機版背景圖 (MD以上隱藏) */}
                    <div className="absolute inset-0 md:hidden z-0">
                      {item.imageUrl && (
                        <>
                          <Image src={item.imageUrl} alt="" fill className="object-cover opacity-60" style={{ objectPosition: 'center' }} />
                          <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/40 to-transparent" />
                        </>
                      )}
                    </div>

                    {/* 左側：Bento Grid (MD以上顯示) - 結構：左2小圖，右1大圖 */}
                    <div className="hidden md:flex flex-1 h-full p-4 lg:p-6 pr-0 gap-3 lg:gap-4 overflow-hidden">
                      {/* 左欄：上下兩張 */}
                      <div className="flex flex-col gap-3 lg:gap-4 w-1/3 h-full">
                        <div className="relative flex-1 rounded-xl overflow-hidden group">
                          <Image src={item.gridImages[0]} alt="G1" fill className="object-cover transition-transform duration-700 group-hover:scale-110" sizes="20vw"/>
                        </div>
                        <div className="relative flex-1 rounded-xl overflow-hidden group">
                          <Image src={item.gridImages[1]} alt="G2" fill className="object-cover transition-transform duration-700 group-hover:scale-110" sizes="20vw"/>
                        </div>
                      </div>
                      {/* 右欄：一張大圖 */}
                      <div className="w-2/3 h-full rounded-xl overflow-hidden relative group">
                        <Image src={item.gridImages[2]} alt="G3" fill className="object-cover transition-transform duration-700 group-hover:scale-110" sizes="40vw"/>
                      </div>
                    </div>

                    {/* 右側：文字區塊 */}
                    <div className={`
                      /* Mobile: 絕對定位 (保持一致性) */
                      absolute z-20 top-1/2 -translate-y-1/2 right-4 sm:right-8 w-full max-w-xs sm:max-w-sm px-2 sm:px-4
                      
                      /* Desktop: Flex item, 靠右對齊 */
                      md:static md:translate-y-0 md:w-[40%] md:lg:w-[35%] md:max-w-none 
                      md:flex md:flex-col md:justify-center md:items-end 
                      md:px-8 md:lg:px-12 md:py-6
                    `}>
                      <div className="relative z-10 text-right">
                        {item.subtitle && (
                          <div className={`text-sm md:text-base lg:text-lg font-medium tracking-wider mb-2 ${item.textColor ? '' : 'text-gray-300 md:text-gray-500'}`} style={{ color: item.textColor }}>
                            {Array.isArray(item.subtitle) ? item.subtitle[0] : item.subtitle}
                          </div>
                        )}
                        {item.title && (
                          <h2 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-4 sm:mb-6 leading-none shadow-black drop-shadow-md md:drop-shadow-none ${textColorClass}`} style={{ color: item.textColor }}>
                            {item.title}
                          </h2>
                        )}
                        
                        {(item.buttonText) && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); if (isActive) item.onClick?.(); }}
                            className="inline-flex items-center justify-center px-5 py-2 md:px-6 md:py-3 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm md:text-base rounded-xl font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_25px_rgba(139,92,246,0.6)] hover:scale-105 group"
                          >
                            {item.buttonText}
                            <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </button>
                        )}
                      </div>
                    </div>
                 </div>
              ) : item.type === 'grid-layout' && item.gridImages && item.gridImages.length >= 6 ? (
                /* =========================================================
                    模式 B: Grid Layout (左文右圖 - 原有)
                   ========================================================= */
                <div className="w-full h-full block md:flex md:flex-row">
                  {/* 手機版背景圖 */}
                  <div className="absolute inset-0 md:hidden z-0">
                    {item.imageUrl && (
                      <>
                        <Image src={item.imageUrl} alt="" fill className="object-cover opacity-60" style={{ objectPosition: 'center' }} />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                      </>
                    )}
                  </div>

                  {/* 文字內容區塊 */}
                  <div className={`
                    /* Mobile: 絕對定位 (保持一致性) */
                    absolute z-20 top-1/2 -translate-y-1/2 left-4 sm:left-8 md:left-16 lg:left-20 xl:left-28 w-full max-w-xs sm:max-w-sm px-2 sm:px-4

                    /* Desktop: Flex item, 靠左對齊 */
                    md:static md:translate-y-0 md:w-[35%] md:lg:w-[32%] md:max-w-none 
                    md:flex md:flex-col md:justify-center md:items-start 
                    md:px-8 md:lg:px-12 md:py-6
                  `}>
                    <div className="relative z-10 text-left">
                      {item.title && (
                        <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-4 leading-tight shadow-black drop-shadow-md">
                          {item.title}
                        </h2>
                      )}
                      {item.subtitle && (
                        <div className="text-xs sm:text-sm md:text-base lg:text-lg text-white/90 md:text-gray-400 mb-3 sm:mb-6 leading-relaxed line-clamp-2 md:line-clamp-none">
                          {Array.isArray(item.subtitle) ? (
                            item.subtitle.map((line, lineIndex) => (
                              <p key={lineIndex} className={lineIndex < (item.subtitle as string[]).length - 1 ? "mb-1" : ""}>{line}</p>
                            ))
                          ) : (<p>{item.subtitle}</p>)}
                        </div>
                      )}
                      {(item.buttonText) && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); if (isActive) item.onClick?.(); }}
                          className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3 lg:px-6 lg:py-3 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs sm:text-sm md:text-base font-semibold rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 group"
                        >
                          {item.buttonText}
                          <ArrowRight className="ml-1 sm:ml-2 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 transition-transform group-hover:translate-x-1" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 右側 Grid (MD以上才顯示) - 保持不變 */}
                  <div className="hidden md:flex flex-1 h-full p-4 lg:p-6 pl-0 gap-3 lg:gap-4 overflow-hidden">
                    <div className="flex flex-col gap-3 lg:gap-4 w-1/4 h-full">
                      <div className="relative flex-1 rounded-xl overflow-hidden group"><Image src={item.gridImages[0]} alt="G1" fill className="object-cover transition-transform duration-700 group-hover:scale-110" sizes="20vw"/></div>
                      <div className="relative flex-1 rounded-xl overflow-hidden group"><Image src={item.gridImages[1]} alt="G2" fill className="object-cover transition-transform duration-700 group-hover:scale-110" sizes="20vw"/></div>
                    </div>
                    <div className="w-1/4 h-full rounded-xl overflow-hidden relative group"><Image src={item.gridImages[2]} alt="G3" fill className="object-cover transition-transform duration-700 group-hover:scale-110" sizes="20vw"/></div>
                    <div className="flex flex-col gap-3 lg:gap-4 w-1/4 h-full">
                      <div className="relative flex-1 rounded-xl overflow-hidden group"><Image src={item.gridImages[3]} alt="G4" fill className="object-cover transition-transform duration-700 group-hover:scale-110" sizes="20vw"/></div>
                      <div className="relative flex-1 rounded-xl overflow-hidden group"><Image src={item.gridImages[4]} alt="G5" fill className="object-cover transition-transform duration-700 group-hover:scale-110" sizes="20vw"/></div>
                    </div>
                    <div className="w-1/4 h-full rounded-xl overflow-hidden relative group"><Image src={item.gridImages[5]} alt="G6" fill className="object-cover transition-transform duration-700 group-hover:scale-110" sizes="20vw"/></div>
                  </div>
                </div>
              ) : (
                /* =========================================================
                    模式 C: Default Layout (原始單圖模式)
                   ========================================================= */
                <>
                  <Image src={item.imageUrl || ""} alt={item.title || "Banner"} fill className="object-cover" sizes="100vw" priority={index === 0} />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent pointer-events-none" />
                  <div className="absolute left-4 sm:left-8 md:left-16 lg:left-20 xl:left-28 top-1/2 -translate-y-1/2 w-full max-w-xs sm:max-w-sm md:max-w-lg lg:max-w-xl xl:max-w-2xl px-2 sm:px-4">
                    {item.title && <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl 2xl:text-5xl font-bold text-white mb-2 sm:mb-4 leading-tight">{item.title}</h2>}
                    {item.subtitle && (
                      <div className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl text-white/90 mb-3 sm:mb-6 leading-relaxed">
                        {Array.isArray(item.subtitle) ? item.subtitle.map((line, i) => (<p key={i} className={i < (item.subtitle as string[]).length - 1 ? "mb-1 sm:mb-1.5 md:mb-2" : ""}>{line}</p>)) : (<p>{item.subtitle}</p>)}
                      </div>
                    )}
                    {(item.onClick || item.link) && (
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (isActive) { if (item.onClick) item.onClick(); else if (item.link) window.location.href = item.link; } }} style={{ pointerEvents: 'auto' }} className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3 lg:px-6 lg:py-3 bg-custom-logo-purple hover:bg-custom-logo-purple-hover text-white text-xs sm:text-sm md:text-base font-semibold rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer">
                        {item.buttonText}
                        <ChevronRight className="ml-1 sm:ml-2 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      
      {/* 導航與指示器 (保持不變) */}
      {showNavigation && items.length > 1 && (
        <>
          <button onClick={goToPrevious} className="absolute left-2 sm:left-6 top-1/2 transform -translate-y-1/2 p-2 sm:p-3 bg-black/30 hover:bg-black/50 backdrop-blur-md text-white rounded-full transition-all duration-300 hover:scale-110 shadow-lg border border-white/20 z-50 cursor-pointer"><ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" /></button>
          <button onClick={goToNext} className="absolute right-2 sm:right-6 top-1/2 transform -translate-y-1/2 p-2 sm:p-3 bg-black/30 hover:bg-black/50 backdrop-blur-md text-white rounded-full transition-all duration-300 hover:scale-110 shadow-lg border border-white/20 z-50 cursor-pointer"><ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" /></button>
        </>
      )}
      {showIndicators && items.length > 1 && (
        <div className="absolute bottom-3 sm:bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-50">
          {items.map((_, index) => (<button key={index} onClick={() => goToSlide(index)} className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 cursor-pointer shadow-sm ${index === currentIndex ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"}`}/>))}
        </div>
      )}
      {items.length > 1 && !isHovered && (<div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full z-40"><div className="h-full bg-custom-logo-purple transition-all duration-100 ease-linear" style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}/></div>)}
    </div>
  );
};

export default BannerCarousel;