import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import {
  ChevronLeft,
  User,
  ChevronDown,
  Check,
  Moon,
  Sun,
  Monitor,
  Globe,
  Coins,
  CreditCard,
  LogOut,
  FileText,
  Camera,
  Loader2,
  Save,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useTheme } from "../ThemeProvider";
import { useAuth } from "@/app/context/AuthContext";
import ReactDOM from "react-dom";
import OrderHistoryView from "./OrderHistoryView";

// 定義 SettingDialog 組件的 Props 介面
interface SettingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  setOpenPaymentModel: (open: boolean) => void;
  tab?:string
}

// 下拉選單選項類型
interface DropdownProps {
  options: { value: string; label: string; icon?: React.ReactNode }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}

// 法律文件類型
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

// 成功提示組件
const SuccessToast: React.FC<{ message: string; isVisible: boolean }> = ({
  message,
  isVisible,
}) => (
  <div
    className={`fixed top-4 right-4 z-[10001] transition-all duration-300 ${
      isVisible
        ? "translate-y-0 opacity-100"
        : "-translate-y-2 opacity-0 pointer-events-none"
    }`}
  >
    <div className="bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
      <Check className="w-4 h-4" />
      <span className="font-medium">{message}</span>
    </div>
  </div>
);

// 改進的下拉選單組件
const ModernDropdown: React.FC<DropdownProps & { title?: string }> = ({
  options,
  selectedValue,
  onSelect,
  placeholder,
  title,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isPositioned, setIsPositioned] = useState<boolean>(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 計算並更新下拉選單位置
  const updatePosition = useCallback(() => {
    if (!buttonRef.current || !dropdownRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const dropdownRect = dropdownRef.current.getBoundingClientRect();

    const viewportHeight = window.innerHeight;

    // 計算可用空間
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;

    // 獲取實際的下拉選單高度
    const actualDropdownHeight = dropdownRect.height;

    // 決定展開方向
    const shouldOpenUpward =
      spaceBelow < actualDropdownHeight && spaceAbove > spaceBelow;

    let top: number;
    const gap = 4; // 與按鈕的間距

    if (shouldOpenUpward) {
      // 向上展開：按鈕頂部 - 選單實際高度 - 間距
      top = buttonRect.top - actualDropdownHeight - gap;
    } else {
      // 向下展開：按鈕底部 + 間距
      top = buttonRect.bottom + gap;
    }

    // 確保不超出視窗範圍
    if (top < 0) {
      top = gap;
    } else if (top + actualDropdownHeight > viewportHeight) {
      top = viewportHeight - actualDropdownHeight - gap;
    }

    // 水平位置調整
    let left = buttonRect.left;
    const dropdownWidth = buttonRect.width;

    // 確保不超出視窗右邊界
    if (left + dropdownWidth > window.innerWidth) {
      left = window.innerWidth - dropdownWidth - gap;
    }

    // 確保不超出視窗左邊界
    if (left < 0) {
      left = gap;
    }

    setDropdownStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${dropdownWidth}px`,
      zIndex: 10000,
    });

    // 標記已定位完成
    if (!isPositioned) {
      setIsPositioned(true);
    }
  }, [isPositioned]);

  // 點擊按鈕時先計算初始位置
  const handleButtonClick = () => {
    if (!isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      // 設置初始位置（避免從左上角飛入）
      setDropdownStyle({
        position: "fixed",
        top: `${buttonRect.bottom + 4}px`,
        left: `${buttonRect.left}px`,
        width: `${buttonRect.width}px`,
        zIndex: 10000,
        opacity: 0, // 初始透明
      });
      setIsPositioned(false);
    }
    setIsOpen(!isOpen);
  };

  // 處理點擊外部關閉
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsPositioned(false);
      }
    };

    // 延遲添加事件監聽器，避免立即觸發
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // 使用 useLayoutEffect 確保在渲染後立即計算位置
  useLayoutEffect(() => {
    if (isOpen && dropdownRef.current) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  // 監聽視窗變化
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      updatePosition();
    };

    // 監聽可能影響位置的事件
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isOpen, updatePosition]);

  const selectedOption = options.find(
    (option) => option.value === selectedValue
  );

  return (
    <>
      <button
        ref={buttonRef}
        className="flex items-center justify-between min-w-[120px] px-3 py-2 bg-custom-gray dark:bg-custom-gray-dark 
                 hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark 
                 border border-custom-light-purple dark:border-custom-light-purple-dark 
                 rounded-lg transition-all duration-200"
        onClick={handleButtonClick}
        type="button"
        title={title}
      >
        <div className="flex items-center gap-2">
          {selectedOption?.icon}
          <span className="text-sm font-medium text-custom-black dark:text-custom-black-dark">
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* 使用 Portal 將下拉選單渲染到 body */}
      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className={`transition-all duration-200 ${
              isPositioned ? "opacity-100" : "opacity-0"
            }`}
          >
            <div
              className={`py-1 bg-custom-white dark:bg-custom-white-dark rounded-lg shadow-xl 
                        border border-custom-light-purple dark:border-custom-light-purple-dark
                        max-h-60 overflow-auto setting-custom-scrollbar ${
                          isPositioned ? "animate-in fade-in-0 zoom-in-95" : ""
                        }`}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  className="w-full flex items-center justify-between px-3 py-2 text-left 
                         hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark 
                         transition-colors duration-150"
                  onClick={() => {
                    onSelect(option.value);
                    setIsOpen(false);
                    setIsPositioned(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {option.icon}
                    <span className="text-sm text-custom-black dark:text-custom-black-dark">
                      {option.label}
                    </span>
                  </div>
                  {option.value === selectedValue && (
                    <Check className="w-4 h-4 text-custom-logo-purple dark:text-custom-logo-purple-dark" />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

// 法律文件組件
const LegalDocumentView: React.FC<{
  tabId: string;
  language: string;
}> = ({ tabId, language }) => {
  const t = useTranslations("settings");
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 獲取法律文件
  useEffect(() => {
    const fetchDocument = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const typeMapping: { [key: string]: string } = {
          service: "terms",
          privacy: "privacy",
          copyright: "copyright",
          faq: "faq",
        };

        const documentType = typeMapping[tabId];
        const simplifiedLang = 
          language.startsWith("zh") ? "zh-TW" : 
          language.startsWith("ja") ? "ja" : 
          "en";

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SERVER_URL}/api/legal-terms?where[type][equals]=${documentType}&where[locale][equals]=${simplifiedLang}&limit=1`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch document");
        }

        const data = await response.json();
        const doc = data.docs[0];

        if (doc) {
          setDocument(doc);
        } else {
          setError("Document not found");
        }
      } catch (err) {
        console.error(`Error fetching ${tabId} document:`, err);
        setError("Failed to load document");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [tabId, language]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-8 h-8 border-4 border-custom-light-purple dark:border-custom-light-purple-dark rounded-full animate-spin border-t-custom-logo-purple dark:border-t-custom-logo-purple-dark"></div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-custom-light-purple dark:bg-custom-light-purple-dark rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          {t("document_not_found")}
        </p>
      </div>
    );
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-custom-black dark:text-custom-black-dark mb-2">
          {document.title}
        </h2>
        <div className="w-16 h-1 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-full"></div>
      </div>

      <div className="space-y-6">
        {document.sections.map((section, index) => (
          <div key={section.id}>
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
};

// 設置對話框主組件
const SettingDialog: React.FC<SettingDialogProps> = ({
  isOpen,
  onClose,
  setOpenPaymentModel,
  tab
}) => {
  // 使用 next-intl hooks
  const t = useTranslations("settings");
  const locale = useLocale();

  const { theme, toggleTheme } = useTheme();
  const {
    userSettings,
    updateLanguage,
    updateTheme,
    user,
    point,
    userPoint,
    updateUserPoint,
    logout,
    authenticatedRequest,
    updateProfile,
  } = useAuth();

  // 控制對話框可見性的狀態
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const getSafeTab = useCallback((value?: string) => {
    const safeTabs = new Set([
      "general",
      "orders",
    ]);
    return value && safeTabs.has(value) ? value : "general";
  }, []);
  const [activeTab, setActiveTab] = useState<string>(getSafeTab(tab));
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [isLoadingPoint, setIsLoadingPoint] = useState<boolean>(false);
  const [profileName, setProfileName] = useState<string>("");
  const [profileUsername, setProfileUsername] = useState<string>("");
  const [profileBio, setProfileBio] = useState<string>("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>("");
  const [profileAvatarId, setProfileAvatarId] = useState<string | null | undefined>(undefined);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const handleBack = useCallback(() => {
    onClose();
  }, [onClose]);
  const logoutLabel =
    locale === "zh-TW" ? "登出" : locale === "ja" ? "ログアウト" : "Log out";
  const labels = {
    accountTitle:
      locale === "zh-TW" ? "帳戶" : locale === "ja" ? "アカウント" : "Account",
    creditsTitle:
      locale === "zh-TW" ? "點數" : locale === "ja" ? "クレジット" : "Credits",
    preferencesTitle:
      locale === "zh-TW" ? "語言與外觀" : locale === "ja" ? "言語と外観" : "Language and appearance",
    profileSaved:
      locale === "zh-TW" ? "個人資料已更新" : locale === "ja" ? "プロフィールを更新しました" : "Profile updated",
    saveProfile:
      locale === "zh-TW" ? "儲存個人資料" : locale === "ja" ? "プロフィールを保存" : "Save profile",
    changeAvatar:
      locale === "zh-TW" ? "更換大頭貼" : locale === "ja" ? "アバターを変更" : "Change avatar",
    removeAvatar:
      locale === "zh-TW" ? "移除" : locale === "ja" ? "削除" : "Remove",
    uploading:
      locale === "zh-TW" ? "上傳中..." : locale === "ja" ? "アップロード中..." : "Uploading...",
    avatarTypeError:
      locale === "zh-TW" ? "請上傳圖片檔。" : locale === "ja" ? "画像ファイルをアップロードしてください。" : "Please upload an image file.",
    avatarSizeError:
      locale === "zh-TW" ? "圖片大小不可超過 5MB。" : locale === "ja" ? "画像サイズは5MB以下にしてください。" : "Image must be smaller than 5MB.",
    avatarUploadError:
      locale === "zh-TW" ? "大頭貼上傳失敗。" : locale === "ja" ? "アバターのアップロードに失敗しました。" : "Failed to upload avatar.",
    name:
      locale === "zh-TW" ? "名稱" : locale === "ja" ? "名前" : "Name",
    username:
      locale === "zh-TW" ? "使用者名稱" : locale === "ja" ? "ユーザー名" : "Username",
    bio:
      locale === "zh-TW" ? "個人簡介" : locale === "ja" ? "自己紹介" : "Bio",
    bioPlaceholder:
      locale === "zh-TW" ? "寫一段簡短的自我介紹..." : locale === "ja" ? "短い自己紹介を書いてください..." : "Write a short bio...",
    connectedAccounts:
      locale === "zh-TW" ? "已連結帳號" : locale === "ja" ? "連携済みアカウント" : "Connected accounts",
    currentLogin:
      locale === "zh-TW" ? "目前登入來源" : locale === "ja" ? "現在のログイン元" : "Current login provider",
  };

  // 🔥 監聽 tab prop 變化，更新 activeTab
  useEffect(() => {
    if (tab) {
      setActiveTab(getSafeTab(tab));
    }
  }, [getSafeTab, tab]);

  // 設定狀態
  const [themeOption, setThemeOption] = useState<string>(
    theme === "dark" ? "dark" : "light"
  );
  const [language, setLanguage] = useState<string>("auto");

  // 🔥 關鍵修正：當對話框打開時更新積分
  useEffect(() => {
    const updatePointWhenOpen = async () => {
      if (isOpen && user) {
        setIsLoadingPoint(true);
        try {
          await updateUserPoint();
        } catch (error) {
          console.error("Failed to update points:", error);
        } finally {
          setIsLoadingPoint(false);
        }
      }
    };

    updatePointWhenOpen();
  }, [isOpen, user, updateUserPoint]);

  // 顯示成功提示
  const showToast = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  // 主題選項配置
  const themeOptions = [
    {
      value: "system",
      label: t("theme_options.system"),
      icon: <Monitor className="w-4 h-4" />,
    },
    {
      value: "light",
      label: t("theme_options.light"),
      icon: <Sun className="w-4 h-4" />,
    },
    {
      value: "dark",
      label: t("theme_options.dark"),
      icon: <Moon className="w-4 h-4" />,
    },
  ];

  // 語言選項配置
  const languageOptions = [
    {
      value: "auto",
      label: t("language_options.auto"),
      icon: <Globe className="w-4 h-4" />,
    },

    {
      value: "english",
      //label: t("language_options.english"),
      label: "English",
      icon: (
        <span className="text-xs font-medium w-4 h-4 flex items-center justify-center">
          EN
        </span>
      ),
    },
    {
      value: "chinese",
      label: "中文",
      icon: (
        <span className="text-xs font-medium w-4 h-4 flex items-center justify-center">
          中
        </span>
      ),
    },
    {
      value: "japanese",
      label: "日本語",
      icon: (
        <span className="text-xs font-medium w-4 h-4 flex items-center justify-center">
          日
        </span>
      ),
    },
  ];

  // 菜單項定義
  const tabs = [
    {
      id: "general",
      label: t("tabs.general"),
      icon: User,
    },
    {
      id: "orders",
      label: t("tabs.orders"),
      icon: CreditCard,
    },
  ];

  // 語言變更處理
  const handleLanguageChange = async (selectedLanguage: string) => {
    // 立即更新本地狀態以反映用戶選擇
    setLanguage(selectedLanguage);

    let backendValue = "DEFAULT";
    let newLocale = locale;

    if (selectedLanguage === "english") {
      backendValue = "EN";
      newLocale = "en";
    } else if (selectedLanguage === "chinese") {
      backendValue = "ZH";
      newLocale = "zh-TW";
    } else if (selectedLanguage === "japanese") {
      backendValue = "JA";
      newLocale = "ja";
    } else if (selectedLanguage === "auto") {
      backendValue = "DEFAULT";
      const browserLang = navigator.language;
      if (browserLang.includes("zh")) {
        newLocale = "zh-TW";
      } else if (browserLang.includes("ja")) {
        newLocale = "ja";
      } else {
        newLocale = "en";
      }
    }

    // 更新後端設定
    await updateLanguage(backendValue);

    // 語言切換邏輯
    if (newLocale !== locale) {
      const fullPath = window.location.pathname;
      const searchParams = window.location.search;
      const hash = window.location.hash;

      // 使用正則表達式處理路徑
      const localePattern = new RegExp(`^/(${locale})(/.*)?$`);
      const match = fullPath.match(localePattern);

      let pathWithoutLocale = "";
      if (match && match[2]) {
        pathWithoutLocale = match[2];
      }

      // 設定 cookie
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${
        365 * 24 * 60 * 60
      }`;

      // 構建新 URL
      const newUrl = `${window.location.protocol}//${window.location.host}/${newLocale}${pathWithoutLocale}${searchParams}${hash}`;

      // console.log('語言切換:', {
      //   from: fullPath,
      //   to: newUrl,
      //   locale: locale,
      //   newLocale: newLocale
      // });

      onClose();
      window.location.href = newUrl;
      return;
    }

    showToast(t("success.language_updated"));
  };

  // 主題變更處理
  const handleThemeChange = async (selectedTheme: string) => {
    setThemeOption(selectedTheme);

    let backendValue = "DARK";
    if (selectedTheme === "light") {
      backendValue = "LIGHT";
    } else if (selectedTheme === "dark") {
      backendValue = "DARK";
    } else if (selectedTheme === "system") {
      backendValue = "DARK";
    }

    await updateTheme(backendValue);

    if (
      (selectedTheme === "dark" && theme === "light") ||
      (selectedTheme === "light" && theme === "dark")
    ) {
      toggleTheme();
    }

    showToast(t("success.theme_updated"));
  };

  // 🔥 購買積分按鈕處理 - 加入積分更新
  const handlePurchaseClick = async () => {
    // 先更新一次積分確保是最新的
    setIsLoadingPoint(true);
    try {
      await updateUserPoint();
    } finally {
      setIsLoadingPoint(false);
    }

    setOpenPaymentModel(true);
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setProfileError(null);
    try {
      const body: { name?: string; username?: string; bio?: string; avatar?: string | null } = {
        name: profileName,
        username: profileUsername,
        bio: profileBio,
      };
      if (profileAvatarId !== undefined) {
        body.avatar = profileAvatarId;
      }
      const updated = await updateProfile(body);
      if (updated) {
        showToast(labels.profileSaved);
      }
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : labels.avatarUploadError);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError(labels.avatarTypeError);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError(labels.avatarSizeError);
      return;
    }

    setIsUploadingAvatar(true);
    setProfileError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/user/profile/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.id) {
        throw new Error(data?.error || labels.avatarUploadError);
      }

      setProfileAvatarUrl(data?.url || data?.doc?.url || "");
      setProfileAvatarId(String(data.id));
    } catch (error) {
      console.error("Failed to upload avatar", error);
      setProfileError(error instanceof Error ? error.message : labels.avatarUploadError);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // 對話框可見性控制
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 用戶設定初始化
  const hasInitialized = useRef(false);
  const resolveAvatarUrl = useCallback((avatar: unknown): string => {
    if (typeof avatar === "string") {
      return /^https?:\/\//i.test(avatar) || avatar.startsWith("/") ? avatar : "";
    }
    if (avatar && typeof avatar === "object" && "url" in avatar) {
      const url = (avatar as { url?: unknown }).url;
      return typeof url === "string" ? url : "";
    }
    return "";
  }, []);

  useEffect(() => {
    setProfileName(user?.name || "");
    setProfileUsername(user?.username || "");
    setProfileBio(user?.bio || "");
    setProfileAvatarUrl(resolveAvatarUrl(user?.avatar));
    setProfileAvatarId(undefined);
  }, [resolveAvatarUrl, user?.avatar, user?.bio, user?.name, user?.username]);

  useEffect(() => {
    if (!isOpen || !user) return;

    let cancelled = false;
    const loadProfile = async () => {
      try {
        const response = await authenticatedRequest("/api/user/profile");
        if (!response?.ok) return;
        const data = await response.json().catch(() => null);
        const profile = data?.profile;
        if (cancelled || !profile) return;
        setProfileName(profile.name || "");
        setProfileUsername(profile.username || "");
        setProfileBio(profile.bio || "");
        setProfileAvatarUrl(resolveAvatarUrl(profile.avatar));
        setProfileAvatarId(undefined);
      } catch (error) {
        console.error("Failed to load profile", error);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [authenticatedRequest, isOpen, resolveAvatarUrl, user]);

  useEffect(() => {
    if (userSettings) {
      if (userSettings.language) {
        const langMapping: { [key: string]: string } = {
          ZH: "chinese",
          EN: "english",
          JA: "japanese",
          DEFAULT: "auto",
        };

        const langConfig = langMapping[userSettings.language];
        if (langConfig) {
          setLanguage(langConfig);
        }
      } else {
        // 如果沒有用戶設定，根據當前 locale 設定預設值
        const defaultLang = 
          locale === "en" ? "english" : 
          locale === "zh-TW" ? "chinese" : 
          locale === "ja" ? "japanese" : 
          "auto";
        setLanguage(defaultLang);
      }

      if (userSettings.theme) {
        const themeMapping: { [key: string]: string } = {
          DARK: "dark",
          LIGHT: "light",
          DEFAULT: "system",
        };

        const themeDisplay = themeMapping[userSettings.theme];
        if (themeDisplay) {
          setThemeOption(themeDisplay);
        }
      }

      hasInitialized.current = true;
    }
  }, [userSettings, locale]);

  if (!isVisible && !isOpen) return null;

  return (
    <>
      <SuccessToast message={successMessage} isVisible={showSuccessToast} />

      <div
        className={`fixed inset-0 z-[9999] overflow-hidden outline-none focus:outline-none transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[4px] transition-opacity duration-300 ease-in-out"
          onClick={onClose}
        />

        <div
          className={`setting-custom-scrollbar relative h-full w-full overflow-y-auto transition-all duration-300 ease-in-out
            ${isOpen ? "scale-100 opacity-100" : "scale-[0.99] opacity-0"}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex min-h-full w-full flex-col border-0 bg-custom-white outline-none focus:outline-none dark:bg-custom-white-dark">
            <div className="w-full px-4 pb-2 pt-4 md:px-8 md:pt-6">
              <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
                <button
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-stone-500 transition-colors duration-200 hover:bg-stone-100/80 hover:text-stone-900 dark:text-white/55 dark:hover:bg-white/[0.04] dark:hover:text-white"
                  onClick={handleBack}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
                <div className="w-10" />
              </div>
            </div>

            <div className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-1 md:px-8 md:pb-12">
              <header className="flex w-full items-center justify-between pb-2 md:h-20 md:items-end">
                <h1 className="hidden min-w-0 items-center gap-2 truncate text-2xl font-bold text-stone-900 md:flex dark:text-white">
                  {t("title")}
                </h1>
                <div />
              </header>

              <main className="mt-4 w-full md:mt-6">
                <h1 className="mb-4 text-2xl font-bold text-stone-900 md:hidden dark:text-white">
                  {t("title")}
                </h1>

                <div className="grid w-full grid-cols-1 gap-y-6 md:my-8 md:grid-cols-[220px_minmax(0,_1fr)] md:gap-x-8">
                  <div className="relative z-10 mb-2 min-w-0 w-full self-start md:sticky md:top-4 md:mb-0">
                    <nav aria-label={t("title")} className="min-w-0">
                      <div className="overflow-x-auto overflow-y-hidden md:overflow-visible">
                        <ul className="flex gap-1 md:flex-col">
                          {tabs.map((tabItem) => {
                            const Icon = tabItem.icon;
                            const isActive = activeTab === tabItem.id;
                            return (
                              <li key={tabItem.id}>
                                <button
                                  onClick={() => setActiveTab(tabItem.id)}
                                  className={`flex h-9 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-left text-sm font-medium transition-all duration-150 active:scale-[0.99] md:w-full ${
                                    isActive
                                      ? "bg-white text-stone-900 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12)] dark:bg-[rgba(139,92,246,0.18)] dark:text-white"
                                      : "text-stone-500 hover:bg-stone-100/80 hover:text-stone-900 dark:text-white/55 dark:hover:bg-white/[0.04] dark:hover:text-white"
                                  }`}
                                >
                                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-custom-logo-purple dark:text-custom-logo-purple-dark" : ""}`} />
                                  <span>{tabItem.label}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </nav>
                  </div>

                  <div className="min-w-0 w-full">
                    <div
                      key={activeTab}
                      className="relative animate-in fade-in slide-in-from-right-1 duration-200 pb-4 md:pr-6"
                    >
                  {activeTab === "general" ? (
                    <div className="space-y-0">
                      <section className="mb-8 border-b border-stone-200/80 pb-8 dark:border-white/10">
                        <div className="mb-5">
                          <h2 className="text-lg font-semibold text-stone-900 dark:text-white">
                            {labels.accountTitle}
                          </h2>
                        </div>
                        {profileError && (
                          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {profileError}
                          </div>
                        )}
                        <div className="rounded-2xl border border-stone-200/70 bg-white/80 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] dark:border-white/10 dark:bg-white/[0.02]">
                          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex min-w-0 items-center gap-4">
                              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-custom-logo-purple text-white ring-1 ring-stone-200/70 dark:bg-custom-logo-purple-dark dark:ring-white/10">
                                {profileAvatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={profileAvatarUrl}
                                    alt={user?.name || "avatar"}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <User className="h-6 w-6" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => avatarInputRef.current?.click()}
                                  disabled={isUploadingAvatar}
                                  className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                                  title={labels.changeAvatar}
                                >
                                  {isUploadingAvatar ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Camera className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                              <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                className="hidden"
                                onChange={handleAvatarFileChange}
                              />
                              <div className="min-w-0">
                                <h2 className="text-lg font-semibold text-stone-900 dark:text-white">
                                  {user?.name || t("user_info.guest")}
                                </h2>
                                <p className="truncate text-sm text-stone-500 dark:text-white/55">
                                  {user?.email || t("user_info.no_email")}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    disabled={isUploadingAvatar}
                                    className="rounded-lg border border-stone-200/80 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/[0.04]"
                                  >
                                    {isUploadingAvatar ? labels.uploading : labels.changeAvatar}
                                  </button>
                                  {profileAvatarUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setProfileAvatarUrl("");
                                        setProfileAvatarId(null);
                                      }}
                                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                                    >
                                      {labels.removeAvatar}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-xl">
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium text-stone-500 dark:text-white/45">
                                  {labels.name}
                                </span>
                                <input
                                  value={profileName}
                                  onChange={(event) => setProfileName(event.target.value)}
                                  className="h-10 w-full rounded-xl border border-stone-200/80 bg-white px-3 text-sm text-stone-900 outline-none transition-colors focus:border-custom-logo-purple dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-custom-logo-purple-dark"
                                />
                              </label>
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium text-stone-500 dark:text-white/45">
                                  {labels.username}
                                </span>
                                <input
                                  value={profileUsername}
                                  onChange={(event) => setProfileUsername(event.target.value)}
                                  className="h-10 w-full rounded-xl border border-stone-200/80 bg-white px-3 text-sm text-stone-900 outline-none transition-colors focus:border-custom-logo-purple dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-custom-logo-purple-dark"
                                />
                              </label>
                              <label className="space-y-1.5 sm:col-span-2">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-xs font-medium text-stone-500 dark:text-white/45">
                                    {labels.bio}
                                  </span>
                                  <span className="text-[11px] text-stone-400 dark:text-white/35">
                                    {profileBio.length}/500
                                  </span>
                                </div>
                                <textarea
                                  value={profileBio}
                                  maxLength={500}
                                  rows={3}
                                  onChange={(event) => setProfileBio(event.target.value.slice(0, 500))}
                                  placeholder={labels.bioPlaceholder}
                                  className="w-full resize-none rounded-xl border border-stone-200/80 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition-colors focus:border-custom-logo-purple dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-custom-logo-purple-dark"
                                />
                              </label>
                              <div className="sm:col-span-2 rounded-xl border border-stone-200/80 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                                <p className="mb-2 text-xs font-medium text-stone-500 dark:text-white/45">
                                  {labels.connectedAccounts}
                                </p>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold capitalize text-stone-900 dark:text-white">
                                      {user?.authProvider || "local"}
                                    </p>
                                    <p className="text-xs text-stone-500 dark:text-white/45">
                                      {labels.currentLogin}
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
                                    Connected
                                  </span>
                                </div>
                              </div>
                              <div className="sm:col-span-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={handleSaveProfile}
                                  disabled={isSavingProfile}
                                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-custom-logo-purple px-4 text-sm font-semibold text-white transition-colors hover:bg-custom-logo-purple-hover disabled:cursor-not-allowed disabled:opacity-70 dark:bg-custom-logo-purple-dark dark:hover:bg-custom-logo-purple-hover-dark"
                                >
                                  {isSavingProfile ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                  {labels.saveProfile}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6">
                          <h2 className="mb-3 text-lg font-semibold text-stone-900 dark:text-white">
                            {labels.creditsTitle}
                          </h2>
                        </div>
                        <div className="mt-6 rounded-2xl border border-stone-200/70 bg-white/75 px-4 py-4 dark:border-white/10 dark:bg-[rgba(139,92,246,0.12)]">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                              <Coins className="h-5 w-5 text-custom-logo-purple dark:text-custom-logo-purple-dark" />
                              <div className="min-w-0">
                                {isLoadingPoint ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-custom-logo-purple border-t-transparent dark:border-custom-logo-purple-dark" />
                                    <span className="text-sm text-stone-500 dark:text-white/55">
                                      Loading
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-lg font-semibold text-stone-900 dark:text-white">
                                      {point || 0}
                                    </p>
                                    <p className="text-sm text-stone-500 dark:text-white/55">
                                      +{userPoint?.extraPoints || 0} {t("extra_points")}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={handlePurchaseClick}
                              disabled={isLoadingPoint}
                              className="inline-flex h-9 min-w-[5rem] items-center justify-center rounded-xl bg-custom-logo-purple px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-custom-logo-purple-hover disabled:cursor-not-allowed disabled:opacity-70 dark:bg-custom-logo-purple-dark dark:hover:bg-custom-logo-purple-hover-dark"
                            >
                              {t("user_info.purchase")}
                            </button>
                          </div>
                        </div>

                        {user ? (
                          <div className="mt-4 flex justify-end">
                            <button
                              onClick={async () => {
                                await logout();
                                onClose();
                              }}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition-colors duration-150 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/12 dark:text-red-300 dark:hover:bg-red-500/18"
                            >
                              <LogOut className="h-4 w-4" />
                              {logoutLabel}
                            </button>
                          </div>
                        ) : null}
                      </section>

                      <section className="mb-8 border-b border-stone-200/80 pb-8 dark:border-white/10">
                        <div className="mb-5">
                          <h2 className="text-lg font-semibold text-stone-900 dark:text-white">
                            {labels.preferencesTitle}
                          </h2>
                        </div>
                        <div className="space-y-0 overflow-hidden rounded-2xl border border-stone-200/70 bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.03)] dark:border-white/10 dark:bg-white/[0.02]">
                          <div className="flex items-center justify-between gap-4 px-4 py-4">
                            <span className="text-sm font-medium text-stone-900 dark:text-white">
                              {t("settings.theme")}
                            </span>
                            <ModernDropdown
                              options={themeOptions}
                              selectedValue={themeOption}
                              onSelect={handleThemeChange}
                              placeholder={t("please_select")}
                            />
                          </div>

                          <div className="border-t border-stone-200/70 dark:border-white/10">
                            <div className="flex items-center justify-between gap-4 px-4 py-4">
                              <span className="text-sm font-medium text-stone-900 dark:text-white">
                                {t("settings.language")}
                              </span>
                              <ModernDropdown
                                options={languageOptions}
                                selectedValue={language}
                                onSelect={handleLanguageChange}
                                placeholder={t("please_select")}
                                title={t("select_language")}
                              />
                            </div>
                          </div>

                        </div>
                      </section>
                    </div>
                  ) : activeTab === "orders" ? (
                    <OrderHistoryView />
                  ) : (
                    <LegalDocumentView tabId={activeTab} language={locale} />
                  )}
                </div>
              </div>
              </div>
              </main>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .setting-custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }

        .setting-custom-scrollbar::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .setting-custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .setting-custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 9999px;
          border: 2px solid transparent;
          background-clip: content-box;
        }

        .setting-custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #1f1f1f;
          border: 2px solid transparent;
          background-clip: content-box;
        }

        .setting-custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #111111;
          border: 2px solid transparent;
          background-clip: content-box;
        }

        .dark .setting-custom-scrollbar {
          scrollbar-color: transparent transparent;
        }

        .dark .setting-custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border: 2px solid transparent;
          background-clip: content-box;
        }

        .dark .setting-custom-scrollbar:hover {
          scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
        }

        .setting-custom-scrollbar:hover {
          scrollbar-color: #1f1f1f transparent;
        }

        .dark .setting-custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.28);
          border: 2px solid transparent;
          background-clip: content-box;
        }

        .dark .setting-custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
          border: 2px solid transparent;
          background-clip: content-box;
        }
      `}</style>
    </>
  );
};

export default SettingDialog;
