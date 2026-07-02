"use client";

import React, { useState, useEffect } from "react";

const HeroBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // 角色配置：精確還原圖片位置
  const heros = [
    // 左側 - 粉髮女孩（後方，上方）
    {
      id: "c01",
      image: "/images/heros/c01.png",
      position: "left",
      delay: 0,
      style: { left: "-5%", top: "4%", width: "50%", zIndex: 2 },
      effect: "pink",
    },
    // 左側 - 黑衣忍者（前方，下方）
    {
      id: "c02",
      image: "/images/heros/c02.png",
      position: "left",
      delay: 200,
      style: { left: "-3%", bottom: "-22%", width: "50%", zIndex: 4 },
      effect: "dark",
    },
    // 中央 - 白髮少年（最前方，視覺中心）
    {
      id: "c03",
      image: "/images/heros/c03.png",
      position: "center",
      delay: 400,
      style: {
        left: "50%",
        bottom: "-30%",
        width: "50%",
        transform: "translateX(-50%)",
        zIndex: 5,
      },
      effect: "blue",
    },
    // 右側 - 綠格子角色（前方，下方）
    {
      id: "c04",
      image: "/images/heros/c04.png",
      position: "right",
      delay: 600,
      style: { right: "0%", bottom: "-12%", width: "45%", zIndex: 4 },
      effect: "fire",
    },
    // 右側 - 紫髮女性（後方，上方）
    {
      id: "c05",
      image: "/images/heros/c05.png",
      position: "right",
      delay: 800,
      style: { right: "-7%", top: "-5%", width: "55%", zIndex: 3 },
      effect: "purple",
    },
  ];

  const getAnimationClass = (position: string, show: boolean) => {
    if (!show) {
      if (position === "left") return "-translate-x-full opacity-0";
      if (position === "right") return "translate-x-full opacity-0";
      if (position === "center") return "scale-50 opacity-0";
    }
    return "translate-x-0 scale-100 opacity-100";
  };

  const getEffectGlow = (effect: string) => {
    const glows = {
      pink: "from-pink-500/30 via-pink-300/20",
      dark: "from-purple-900/30 via-purple-700/20",
      blue: "from-cyan-400/40 via-blue-300/20",
      fire: "from-orange-500/40 via-red-400/20",
      purple: "from-purple-500/40 via-fuchsia-400/20",
    };
    return glows[effect as keyof typeof glows] || "from-white/10 via-white/5";
  };

  // 文字逐個出現
  const topChars = ["こ", "れ", "は"];
  const bottomChars = ["鬼", "滅", "の", "刃"];

  return (
    // ▼ 外層高度在這裡增加（不影響內層 16:9 與人物座標）
    <div className="relative w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden pb-[5vh] md:pb-[14vh]">
      {/* ▼ 底部長距離淡出到黑色（覆蓋背景、但不壓人物/標題） */}
      <div
        className="z-[99] pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-b from-transparent via-[#020617]/80 to-[#020617] "
        aria-hidden
      />

      {/* 內層 16:9 容器（維持原本高度與定位基準） */}
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        {/* 內層內容整體提高層級，蓋在底部淡出之上 */}
        <div className="absolute inset-0 z-[10]">
          {/* 背景特效層 */}
          <div className="absolute inset-0">
            {/* 左側粉色光暈 */}
            <div className="absolute left-0 top-0 w-1/3 h-2/3 bg-pink-500/10 blur-[120px] animate-pulse" />
            {/* 右側紫色光暈 */}
            <div
              className="absolute right-0 top-0 w-1/3 h-2/3 bg-purple-500/10 blur-[120px] animate-pulse"
              style={{ animationDelay: "1s" }}
            />
            {/* 中央藍色光暈 */}
            <div
              className="absolute left-1/2 bottom-0 w-1/4 h-1/2 -translate-x-1/2 bg-cyan-400/10 blur-[100px] animate-pulse"
              style={{ animationDelay: "0.5s" }}
            />

            {/* 櫻花飄落 */}
            {[...Array(12)].map((_, i) => (
              <div
                key={`sakura-${i}`}
                className="absolute animate-float-slow"
                style={{
                  left: `${10 + Math.random() * 30}%`,
                  top: `${-10 + Math.random() * 50}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${8 + Math.random() * 12}s`,
                }}
                aria-hidden
              >
                <div className="w-2 h-2 md:w-3 md:h-3 bg-pink-300 rounded-full blur-sm opacity-60" />
              </div>
            ))}
            {/* 紫色粒子 */}
            {[...Array(12)].map((_, i) => (
              <div
                key={`particle-${i}`}
                className="absolute animate-float-slow"
                style={{
                  right: `${10 + Math.random() * 30}%`,
                  top: `${-10 + Math.random() * 50}%`,
                  animationDelay: `${Math.random() * 4}s`,
                  animationDuration: `${6 + Math.random() * 10}s`,
                }}
                aria-hidden
              >
                <div className="w-2 h-2 md:w-3 md:h-3 bg-purple-400 rounded-full blur-sm opacity-50" />
              </div>
            ))}
          </div>

          {/* 角色層 */}
          {heros.map((char) => (
            <div
              key={char.id}
              className={`absolute transition-all duration-1000 ease-out ${getAnimationClass(
                char.position,
                isVisible
              )}`}
              style={{ ...char.style, transitionDelay: `${char.delay}ms` }}
            >
              <div className="relative w-full h-auto">
                <img
                  src={char.image}
                  alt={`Hero ${char.id}`}
                  className="w-full h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    const colors = {
                      pink: "FF69B4",
                      dark: "1a1a1a",
                      blue: "00BFFF",
                      fire: "FF4500",
                      purple: "9333EA",
                    };
                    const color =
                      colors[char.effect as keyof typeof colors] || "CCCCCC";
                    (e.currentTarget as HTMLImageElement).src = `https://via.placeholder.com/400x800/${color}/FFFFFF?text=${char.id}`;
                  }}
                />
                {/* 角色專屬光暈 */}
                <div
                  className={`absolute inset-0 bg-gradient-to-t ${getEffectGlow(
                    char.effect
                  )} to-transparent blur-3xl -z-10 opacity-80`}
                />
              </div>
            </div>
          ))}

          {/* 中央標題層 */}
          <div className="absolute inset-0 flex items-start justify-center pointer-events-none" style={{ zIndex: 6 }}>
            <div className="text-center mt-12">
              {/* 上排：これは */}
              <div className="mb-2 md:mb-4 leading-none">
                {topChars.map((char, index) => (
                  <span
                    key={`top-${index}`}
                    className="inline-block font-[KokuryuTtf] text-5xl sm:text-7xl md:text-9xl lg:text-[10rem] font-bold text-white opacity-0 animate-char-appear"
                    style={{
                      textShadow: `
                        4px 4px 0px #000000,
                        -2px -2px 0px #000000,
                        2px -2px 0px #000000,
                        -2px 2px 0px #000000,
                        2px 2px 0px #000000
                      `,
                      animationDelay: `${1000 + index * 150}ms`,
                      animationFillMode: "forwards",
                    }}
                  >
                    {char}
                  </span>
                ))}
              </div>
              {/* 下排：鬼滅の刃 */}
              <div className="leading-none">
                {bottomChars.map((char, index) => (
                  <span
                    key={`bottom-${index}`}
                    className="inline-block font-[KokuryuTtf] text-5xl sm:text-7xl md:text-9xl lg:text-[10rem] font-bold text-white opacity-0 animate-char-appear"
                    style={{
                      textShadow: `
                        4px 4px 0px #000000,
                        -2px -2px 0px #000000,
                        2px -2px 0px #000000,
                        -2px 2px 0px #000000,
                        2px 2px 0px #000000
                      `,
                      animationDelay: `${1000 + topChars.length * 150 + index * 150}ms`,
                      animationFillMode: "forwards",
                    }}
                  >
                    {char}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 動畫樣式 */}
      <style jsx>{`
        @keyframes float-slow {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.3; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        @keyframes char-appear {
          0% { opacity: 0; transform: scale(0.5) translateY(20px); }
          50% { transform: scale(1.1) translateY(-5px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-float-slow { animation: float-slow linear infinite; }
        .animate-char-appear { animation: char-appear .4s ease-out; }
      `}</style>
    </div>
  );
};

export default HeroBanner;
