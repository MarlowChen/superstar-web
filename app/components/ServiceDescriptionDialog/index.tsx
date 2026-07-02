import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

interface ServiceDescriptionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ServiceDescriptionDialog: React.FC<ServiceDescriptionDialogProps> = ({ isOpen, onClose }) => {
  const t = useTranslations("navigation");
  
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = "";
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[10002] flex justify-center items-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none transition-opacity duration-300 ease-in-out ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-in-out"
        onClick={onClose}
      />

      <div
        className={`relative w-full transition-all duration-300 ease-in-out
          ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}
          md:max-w-4xl lg:max-w-5xl xl:max-w-6xl md:mx-auto md:my-6 md:px-6 lg:px-8
          max-w-full mx-0 my-0 h-full md:h-auto
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-col w-full h-full md:h-auto bg-custom-white dark:bg-custom-white-dark border-0 md:rounded-xl shadow-lg outline-none focus:outline-none">
          
          <div className="flex-shrink-0 flex items-start justify-between p-6 md:p-8 border-b border-custom-light-purple dark:border-custom-light-purple-dark">
            <h3 className="text-2xl md:text-3xl font-bold text-custom-black dark:text-custom-black-dark">
              {t("copyright_title")}
            </h3>
            <button
              className="p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark transition-colors duration-200"
              onClick={onClose}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto max-h-[calc(100vh-200px)] md:max-h-[60vh]">
            <div className="p-6 md:p-8 lg:p-10">
              <div className="max-w-4xl mx-auto space-y-8 text-custom-black dark:text-custom-black-dark">
                {/* 歡迎文字 */}
                <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-10">
                  {t("copyright_welcome")}
                </div>
                
                {/* 介紹文字 */}
                <p className="text-lg md:text-xl leading-relaxed text-center max-w-3xl mx-auto">
                  {t("copyright_intro")}
                </p>

                {/* 特色功能 */}
                <div className="bg-custom-light-purple/10 dark:bg-custom-light-purple-dark/10 rounded-xl p-6 md:p-8">
                  <h4 className="text-xl md:text-2xl font-semibold mb-6 flex items-center gap-3">
                    <span className="text-2xl">✨</span> {t("copyright_features_title")}
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                    <div className="flex items-start gap-3">
                      <span className="text-custom-logo-purple dark:text-custom-logo-purple-dark text-xl mt-1">•</span>
                      <span className="text-base md:text-lg">{t("copyright_features_item1")}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-custom-logo-purple dark:text-custom-logo-purple-dark text-xl mt-1">•</span>
                      <span className="text-base md:text-lg">{t("copyright_features_item2")}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-custom-logo-purple dark:text-custom-logo-purple-dark text-xl mt-1">•</span>
                      <span className="text-base md:text-lg">{t("copyright_features_item3")}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-custom-logo-purple dark:text-custom-logo-purple-dark text-xl mt-1">•</span>
                      <span className="text-base md:text-lg">{t("copyright_features_item4")}</span>
                    </div>
                  </div>
                </div>

                {/* 使用步驟 */}
                <div className="bg-custom-light-purple/10 dark:bg-custom-light-purple-dark/10 rounded-xl p-6 md:p-8">
                  <h4 className="text-xl md:text-2xl font-semibold mb-6 flex items-center gap-3">
                    <span className="text-2xl">🎨</span> {t("copyright_how_to_use_title")}
                  </h4>
                  <div className="space-y-5 md:space-y-6">
                    <div className="flex flex-wrap items-baseline gap-2 text-base md:text-lg">
                      <span className="font-medium text-custom-logo-purple dark:text-custom-logo-purple-dark">1.</span>
                      <span>{t("copyright_how_to_use_step1_prefix")}</span>
                      <button className="p-2 flex bg-gray-100 text-custom-white rounded-full hover:bg-custom-logo-purple dark:hover:bg-gray-800 transition-colors duration-200" aria-label="New Drawing">
                        <div className="inline-block w-[16px] h-[16px]">
                          <svg viewBox="0 0 100 100" className="w-full h-full transition-all duration-300 text-custom-white">
                            <path fillRule="evenodd" d="m0.5 28.8c0.4-1.6 0.7-3.3 1.3-4.8 2.8-7.2 9.6-11.9 17.3-11.9 12.5-0.1 24.9-0.1 37.3-0.1q1.9 0.1 2.3 1.5c0.3 0.9 0 1.8-0.8 2.3-0.5 0.4-1.1 0.4-1.7 0.4q-7.4 0-14.9 0c-7.3 0-14.6 0-21.9 0-7.3 0-13.1 4.9-14.5 12-0.2 1-0.2 2-0.2 3q-0.1 24.6 0 49.2c0 8.6 6.3 15 14.9 15q24.6 0 49.3 0c8.5 0 14.9-6.4 14.9-15q0-16.2 0-32.5 0-2.1 1.6-2.5c1.3-0.2 2.4 0.6 2.6 1.9q0 0.4 0 0.7 0 16.3 0 32.6c0 8.9-5.8 16.3-14.4 18.4-0.8 0.2-1.6 0.4-2.4 0.5q-27 0-53.9 0c-0.2 0-0.4-0.1-0.5-0.1q-11.9-2.1-15.6-13.5c-0.3-1-0.5-2.1-0.7-3.2q0-26.9 0-53.9z"></path>
                            <path fillRule="evenodd" d="m36.2 74.5c-2.9 0-5.8 0.1-8.6 0-4.3 0-7.3-3.9-6-8 2.1-6.8 5.7-12.8 11.5-17.2 2.8-2.2 5.9-3.6 9.5-3.8 0.6 0 0.9-0.4 1.2-0.7q10-11.5 19.9-22.9c5.4-6.2 10.7-12.4 16.1-18.5 3.3-3.6 7.5-4.7 12.2-3.3 4.6 1.4 7.4 4.7 8.3 9.4 0.7 4-0.5 7.5-3.3 10.4q-18.8 20.1-37.5 40.2c-0.5 0.5-0.8 1-0.9 1.7-0.9 7.3-7 12.7-14.3 12.7q-4.1 0-8.1 0zm23-41.1c0.3 0.3 0.6 0.3 0.9 0.4 4.2 1.5 7.3 4.2 9.4 8.2 0.3 0.8 0.5 0.7 1 0.1q7.7-8.2 15.4-16.4c2.8-3 5.6-5.9 8.3-9 3.1-3.3 2.7-8.2-0.6-11.1-3.3-2.8-8.1-2.4-11 0.9q-8.9 10.2-17.8 20.4-2.8 3.3-5.6 6.5zm-4.6 25.6c0-3.2-2-6.2-5.6-8.1-4.6-2.4-9-1.5-13 1.3-5.3 3.9-8.4 9.3-10.4 15.4-0.5 1.5 0.5 2.8 2.2 2.8 5.5 0 10.9 0 16.3 0 6-0.1 10.5-4.6 10.5-11.4zm3.5-3.6c2.8-3 5.5-5.9 8.2-8.8 0.4-0.3 0.3-0.7 0.2-1q-2.6-6.8-9.7-8.3c-0.5-0.2-1 0-1.4 0.5-2.1 2.5-4.3 5-6.5 7.5-0.2 0.2-0.6 0.4-0.6 0.9 4.7 1.4 8 4.5 9.8 9.2z"></path>
                          </svg>
                        </div>
                      </button>
                      <span>{t("copyright_how_to_use_step1_suffix")}</span>
                    </div>
                    <div className="flex items-start gap-3 text-base md:text-lg">
                      <span className="font-medium text-custom-logo-purple dark:text-custom-logo-purple-dark">2.</span>
                      <span>{t("copyright_how_to_use_item2")}</span>
                    </div>
                    <div className="flex items-start gap-3 text-base md:text-lg">
                      <span className="font-medium text-custom-logo-purple dark:text-custom-logo-purple-dark">3.</span>
                      <span>{t("copyright_how_to_use_item3")}</span>
                    </div>
                    <div className="flex items-start gap-3 text-base md:text-lg">
                      <span className="font-medium text-custom-logo-purple dark:text-custom-logo-purple-dark">4.</span>
                      <span>{t("copyright_how_to_use_item4")}</span>
                    </div>
                  </div>
                </div>

                {/* 小技巧 */}
                <div className="bg-custom-light-purple/10 dark:bg-custom-light-purple-dark/10 rounded-xl p-6 md:p-8">
                  <h4 className="text-xl md:text-2xl font-semibold mb-6 flex items-center gap-3">
                    <span className="text-2xl">💡</span> {t("copyright_tips_title")}
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                    <div className="flex items-start gap-3">
                      <span className="text-custom-logo-purple dark:text-custom-logo-purple-dark text-xl mt-1">•</span>
                      <span className="text-base md:text-lg">{t("copyright_tips_item1")}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-custom-logo-purple dark:text-custom-logo-purple-dark text-xl mt-1">•</span>
                      <span className="text-base md:text-lg">{t("copyright_tips_item2")}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-custom-logo-purple dark:text-custom-logo-purple-dark text-xl mt-1">•</span>
                      <span className="text-base md:text-lg">{t("copyright_tips_item3")}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-custom-logo-purple dark:text-custom-logo-purple-dark text-xl mt-1">•</span>
                      <span className="text-base md:text-lg">{t("copyright_tips_item4")}</span>
                    </div>
                  </div>
                </div>

                {/* 結尾文字 */}
                <p className="text-center text-lg md:text-xl font-medium text-custom-logo-purple dark:text-custom-logo-purple-dark bg-custom-light-purple/10 dark:bg-custom-light-purple-dark/10 rounded-xl p-6 md:p-8">
                  {t("copyright_conclusion")}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex-shrink-0 flex items-center justify-end p-6 md:p-8 border-t border-custom-light-purple dark:border-custom-light-purple-dark">
            <button
              className="w-full md:w-auto px-8 py-3 rounded-lg font-medium text-lg transition-all duration-300 bg-custom-logo-purple hover:bg-custom-logo-purple-hover dark:bg-custom-logo-purple-dark dark:hover:bg-custom-logo-purple-hover-dark text-custom-white cursor-pointer shadow-lg hover:shadow-xl"
              onClick={onClose}
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDescriptionDialog;