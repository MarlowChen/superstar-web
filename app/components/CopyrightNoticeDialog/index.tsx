import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

interface TermsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree?: () => void;
}

interface Section {
  id: string;
  title: string;
  content: string;
}

interface LegalDocument {
  type: string;
  title: string;
  sections: Section[];
}

const TermsDialog: React.FC<TermsDialogProps> = ({ isOpen, onClose, onAgree }) => {
  const t = useTranslations("legal");
  const locale = useLocale();
  
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [legalDocs, setLegalDocs] = useState<{ [key: string]: LegalDocument }>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  // 當對話框開關狀態改變時的動畫效果
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = "hidden"; // 🔧 防止背景滾動
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = ""; // 🔧 恢復滾動
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  // 🔧 修正：獲取法律文件資料
  useEffect(() => {
    const fetchLegalDocuments = async () => {
      setIsLoading(true);
      try {
        // 獲取當前語言
        const currentLang = locale;
        const simplifiedLang = currentLang.startsWith("zh") ? "zh-TW" : "en";
        
        // 獲取所有文檔類型的法律文件
        const responses = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/legal-terms?where[type][equals]=terms&where[locale][equals]=${simplifiedLang}&limit=1`),
          fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/legal-terms?where[type][equals]=privacy&where[locale][equals]=${simplifiedLang}&limit=1`),
          fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/legal-terms?where[type][equals]=copyright&where[locale][equals]=${simplifiedLang}&limit=1`),
          fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/legal-terms?where[type][equals]=refund&where[locale][equals]=${simplifiedLang}&limit=1`),
          fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/legal-terms?where[type][equals]=cookie&where[locale][equals]=${simplifiedLang}&limit=1`),
        ]);
        
        // 處理響應
        const [terms, privacy, copyright, refund, cookie] = await Promise.all(
          responses.map(response => response.json().then(data => data.docs[0]))
        );
        
        setLegalDocs({
          terms: terms ? { ...terms, sections: terms.sections || [] } : null,
          privacy: privacy ? { ...privacy, sections: privacy.sections || [] } : null,
          copyright: copyright ? { ...copyright, sections: copyright.sections || [] } : null,
          refund: refund ? { ...refund, sections: refund.sections || [] } : null,
          cookie: cookie ? { ...cookie, sections: cookie.sections || [] } : null,
        });
        
      } catch (error) {
        console.error("Error fetching legal documents:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isOpen) {
      fetchLegalDocuments();
    }
  }, [isOpen, locale]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setScrolledToBottom(isAtBottom);
    }
  };

  // 動態標籤定義
  const tabs = [
    { id: "terms", label: t("legal.tabs.terms") },
    { id: "privacy", label: t("legal.tabs.privacy") },
    { id: "copyright", label: t("legal.tabs.copyright") },
    { id: "refund", label: t("legal.tabs.refund") },
    { id: "cookie", label: t("legal.tabs.cookie") },
  ];

  // 當對話框尚未顯示時不渲染內容
  if (!isVisible && !isOpen) return null;

  // 判斷有沒有任何條款內容
  const hasAnyDoc = ["terms", "privacy", "copyright", "refund", "cookie"].some(
    (key) => legalDocs[key]
  );

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
          md:max-w-4xl md:mx-auto md:my-6 md:px-4
          max-w-full mx-0 my-0 h-full md:h-auto
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-col w-full h-full md:h-auto bg-custom-white dark:bg-custom-white-dark border-0 md:rounded-xl shadow-lg outline-none focus:outline-none overflow-hidden">
          
          {/* 🔧 標題列 */}
          <div className="flex items-start justify-between p-5 border-b border-custom-light-purple dark:border-custom-light-purple-dark">
            <h3 className="text-2xl font-bold text-custom-black dark:text-custom-black-dark">
              {t("legal.title")}
            </h3>
            <button
              className="p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark transition-colors duration-200"
              onClick={onClose}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="w-full">
            <div
              className="relative p-6 flex-auto overflow-y-auto max-h-[calc(100vh-200px)] md:max-h-[60vh]"
              ref={scrollRef}
              onScroll={handleScroll}
            >
              {isLoading ? (
                <div className="flex justify-center items-center h-40">
                  <div className="w-8 h-8 border-4 border-custom-light-purple dark:border-custom-light-purple-dark rounded-full animate-spin border-t-custom-logo-purple dark:border-t-custom-logo-purple-dark"></div>
                </div>
              ) : hasAnyDoc ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {tabs.map((tab) => {
                    const doc = legalDocs[tab.id];
                    
                    // 🔧 只顯示有內容的文檔
                    if (!doc || !doc.sections || doc.sections.length === 0) {
                      return null;
                    }
                    
                    return (
                      <div key={tab.id} className="mb-8">
                        <div className="mb-6">
                          <h2 className="text-xl font-bold text-custom-black dark:text-custom-black-dark mb-2">
                            {doc.title || tab.label}
                          </h2>
                          <div className="w-16 h-1 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-full"></div>
                        </div>
                        
                        <div className="space-y-6">
                          {doc.sections.map((section, index) => (
                            <div key={section.id} className="pb-4">
                              <h3 className="text-lg font-semibold text-custom-black dark:text-custom-black-dark mb-3">
                                {index + 1}. {section.title}
                              </h3>
                              <div className="whitespace-pre-line text-custom-black dark:text-custom-black-dark leading-relaxed">
                                {section.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-custom-light-purple dark:bg-custom-light-purple-dark rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">
                    {t("document_not_found")}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* 🔧 同意按鈕區塊 */}
          {hasAnyDoc && (
            <div className="flex items-center justify-end p-4 border-t border-custom-light-purple dark:border-custom-light-purple-dark">
              <button
                className={`w-full md:w-auto px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                  scrolledToBottom
                    ? 'bg-custom-logo-purple hover:bg-custom-logo-purple-hover dark:bg-custom-logo-purple-dark dark:hover:bg-custom-logo-purple-hover-dark text-custom-white cursor-pointer'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
                onClick={() => {
                  if (scrolledToBottom) {
                    if (typeof onAgree === 'function') onAgree();
                    else onClose();
                  }
                }}
                disabled={!scrolledToBottom}
              >
                {t("legal.agreeButton")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TermsDialog;