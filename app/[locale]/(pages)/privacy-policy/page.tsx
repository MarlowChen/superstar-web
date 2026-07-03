'use client'

import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";

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

const fallbackLegalDocuments: Record<string, Record<string, LegalDocument>> = {
  "zh-TW": {
    terms: {
      type: "terms",
      title: "服務條款",
      sections: [
        {
          id: "terms-service",
          title: "服務使用",
          content:
            "使用超星AI平台時，請遵守平台規範與相關法令。使用者需自行確認上傳素材具備必要權利，且不得用於侵害他人權益或違反法律的用途。",
        },
      ],
    },
    privacy: {
      type: "privacy",
      title: "隱私權政策",
      sections: [
        {
          id: "privacy-data",
          title: "資料處理",
          content:
            "平台會在提供登入、生成、作品管理、付款與客服支援等服務範圍內處理必要資料。若正式法律文件暫時無法連線，本頁會先顯示本地備援內容，避免使用者看到空白頁。",
        },
      ],
    },
  },
  en: {
    terms: {
      type: "terms",
      title: "Terms of Service",
      sections: [
        {
          id: "terms-service",
          title: "Service Use",
          content:
            "When using Superstar AI Platform, users must follow platform rules and applicable law. Users are responsible for ensuring they have the rights needed for uploaded materials.",
        },
      ],
    },
    privacy: {
      type: "privacy",
      title: "Privacy Policy",
      sections: [
        {
          id: "privacy-data",
          title: "Data Handling",
          content:
            "The platform processes necessary data for sign-in, generation, asset management, payments, and support. If the live legal API is unavailable, this local fallback prevents a blank page.",
        },
      ],
    },
  },
  ja: {
    terms: {
      type: "terms",
      title: "利用規約",
      sections: [
        {
          id: "terms-service",
          title: "サービス利用",
          content:
            "超星AIプラットフォームを利用する際は、プラットフォームの規約および適用法令を遵守してください。アップロード素材に必要な権利を有していることは利用者の責任です。",
        },
      ],
    },
    privacy: {
      type: "privacy",
      title: "プライバシーポリシー",
      sections: [
        {
          id: "privacy-data",
          title: "データの取り扱い",
          content:
            "ログイン、生成、作品管理、支払い、サポートに必要な範囲でデータを処理します。正式な法務APIに接続できない場合は、空白ページを避けるためローカルの予備内容を表示します。",
        },
      ],
    },
  },
};

const getFallbackLegalDocuments = (locale: string) =>
  fallbackLegalDocuments[locale] || fallbackLegalDocuments.en;

const TermsPage: React.FC = () => {
  const t = useTranslations("legal");
  const locale = useLocale();
  const router = useRouter();
  
  const [legalDocs, setLegalDocs] = useState<{ [key: string]: LegalDocument | null }>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  // 獲取法律文件資料
  useEffect(() => {
    const fetchLegalDocuments = async () => {
      setIsLoading(true);
      try {
        const currentLang = locale;
        const simplifiedLang = currentLang.startsWith("zh")
          ? "zh-TW"
          : currentLang.startsWith("ja")
            ? "ja"
            : "en";
        const documentTypes = ["terms", "privacy", "copyright", "refund", "cookie"];

        const responses = await Promise.all(
          documentTypes.map((type) =>
            fetch(
              `/api/legal-terms?where[type][equals]=${type}&where[locale][equals]=${simplifiedLang}&limit=1`
            )
          )
        );
        
        // 處理響應
        const [terms, privacy, copyright, refund, cookie] = await Promise.all(
          responses.map((response) => {
            if (!response.ok) {
              throw new Error(`Legal API responded ${response.status}`);
            }
            return response.json().then((data) => data.docs?.[0] || null);
          })
        );

        const nextDocs = {
          terms: terms ? { ...terms, sections: terms.sections || [] } : null,
          privacy: privacy ? { ...privacy, sections: privacy.sections || [] } : null,
          copyright: copyright ? { ...copyright, sections: copyright.sections || [] } : null,
          refund: refund ? { ...refund, sections: refund.sections || [] } : null,
          cookie: cookie ? { ...cookie, sections: cookie.sections || [] } : null,
        };

        const hasRemoteDoc = Object.values(nextDocs).some(Boolean);
        setLegalDocs(hasRemoteDoc ? nextDocs : getFallbackLegalDocuments(locale));
        
      } catch {
        setLegalDocs(getFallbackLegalDocuments(locale));
      } finally {
        setIsLoading(false);
        // 載入完成後檢查一次滾動狀態
        setTimeout(() => {
          if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20;
            setScrolledToBottom(isAtBottom);
          }
        }, 100);
      }
    };
    
    fetchLegalDocuments();
  }, [locale]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20;
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

  // 判斷有沒有任何條款內容
  const hasAnyDoc = ["terms", "privacy", "copyright", "refund", "cookie"].some(
    (key) => legalDocs[key]
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none bg-custom-white dark:bg-custom-white-dark">
      <div className="relative w-full h-full flex flex-col bg-custom-white dark:bg-custom-white-dark border-0 shadow-lg outline-none focus:outline-none">
        
        {/* 標題列 */}
        <div className="flex items-start justify-between p-5 border-b border-custom-light-purple dark:border-custom-light-purple-dark">
          <h3 className="text-2xl font-bold text-custom-black dark:text-custom-black-dark">
            {t("legal.title") || "版權聲明"}
          </h3>
          <button
            className="p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark transition-colors duration-200"
            onClick={() => router.back()}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="w-full flex-1 flex flex-col">
          <div
            className="relative p-6 flex-auto overflow-y-auto flex-1"
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
                  
                  // 只顯示有內容的文檔
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
                  {t("legal.documentNotFound")}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* 同意按鈕區塊 */}
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
                  router.back();
                }
              }}
              disabled={!scrolledToBottom}
            >
              {t("legal.agreeButton") || "同意"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TermsPage;
