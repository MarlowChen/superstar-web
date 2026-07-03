"use client";

import { useTranslations } from "next-intl";
import React, { useState, useEffect } from "react";

const PSFYoursBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const t = useTranslations("aieroneyours");
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ backgroundColor: "#E8E4DF" }}
    >
      {/* 16:9 等比例容器 - 與原版架構一致 */}
      <div className="relative w-full overflow-hidden" style={{ paddingTop: "56.25%" }}>
        <div className="absolute inset-0 overflow-hidden">
          {/* 第一行文字 - PSF 靠左，佔寬度 2/3 */}
          <div
            className={`
              absolute top-[3%] left-[2%]
              transform transition-all duration-1000 ease-out
              ${isVisible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"}
            `}
            style={{ transitionDelay: "200ms" }}
          >
            <h1
              className="font-black tracking-tight leading-none"
              style={{
                color: "#5A5A5A",
                fontSize: "clamp(3.5rem, 20vw, 18rem)",
              }}
            >
              {t("aierone")}
            </h1>
          </div>

          {/* 第二行文字 - Yours 靠右，佔寬度 1/2 */}
          <div
            className={`
              absolute top-[36%] right-[2%]
              transform transition-all duration-1000 ease-out
              ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
            `}
            style={{ transitionDelay: "400ms" }}
          >
            <h1
              className="font-black tracking-tight leading-none"
              style={{
                color: "#5A5A5A",
                fontSize: "clamp(3.5rem, 20vw, 18rem)",
              }}
            >
              {t("yours")}
            </h1>
          </div>

          {/* 副標題 - 獨立區塊，在 Yours 下方，由下而上進入 */}
          <div
            className={`
              absolute top-[73%] right-[2%]
              transform transition-all duration-700 ease-out
              ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}
            `}
            style={{ transitionDelay: "1000ms" }}
          >
            <div
              className="flex justify-center"
              style={{ width: "clamp(10rem, 52vw, 48rem)" }}
            >
              <p
                className="font-semibold tracking-[0.15em] uppercase leading-relaxed text-center"
                style={{
                  color: "#6B6B6B",
                  fontSize: "clamp(0.5rem, 1.6vw, 1.5rem)",
                }}
              >
                {t("made_to_fit")}
                <br />
                {t("built_for_more")}
              </p>
            </div>
          </div>

          {/* 左下角人物圖片 */}
          <div
            className={`
              absolute left-0 bottom-0 w-[35%] scale-x-[-1]
              transform transition-all duration-1000 ease-out translate-x-5 
              ${isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}
            `}
            style={{ transitionDelay: "600ms" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/aieroneyours/AieroneYours.png"
              alt="Artist Character"
              className="w-full h-auto object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "https://via.placeholder.com/600x800/E8E4DF/5A5A5A?text=Character";
              }}
            />
          </div>
        </div>
      </div>

      {/* 載入字體 */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap');
        
        h1, p {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
      `}</style>
    </section>
  );
};

export default PSFYoursBanner;
