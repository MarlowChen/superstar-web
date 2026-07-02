"use client";

import { AuthProvider, useAuth } from "@/app/context/AuthContext";
import Image from "next/image";
import {
  MenuVisibilityProvider,
  useMenuVisibility,
} from "@/app/context/MenuVisibilityContext";
import { ScrollProvider, useScroll } from "@/app/context/ScrollContext";
import { User } from "@/payload-types";
import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import DesktopSidebar from "../DesktopSidebar";
import MobileSidebar from "../MobileSidebar";
import LoginDialog from "../LoginV2Dialog";
import CopyrightNoticeDialog from "../CopyrightNoticeDialog";
import PaymentModelDialog from "../PaymentModelDialog";
import PaymentConfirmationDialog from "../PaymentConfirmationDialog";
import SettingDialog from "../SettingDialog";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { showToast } from "../CustomToast";
import { useTheme } from "../ThemeProvider";

type Theme = "light" | "dark";

interface RootLayoutClientProps {
  children: React.ReactNode;
  initialUser: User | null;
  initialTheme: Theme;
  disableAuthBootstrap?: boolean;
}

// 🆕 訂單數據類型（匹配 PaymentConfirmationDialog 期望的格式）
type OrderPreviewData = {
  transactionType: string;
  locale: string;
  title: string;
  displayAmount: string;
  subscriptionInfo?: {
    billingCycle: string;
    description: string;
  };
  purchaseInfo?: {
    description: string;
  };
  pointsChange: {
    before: number;
    after: number;
    added: number;
    description: string;
  };
  statusChange: string;
  paymentMethod?: {
    displayText: string;
  };
  proration?: {
    credit: number;
    description: string;
    displayCredit: string;
  };
};

const MOBILE_BREAKPOINT = 768;

function AuthLoadingScreen({ theme }: { theme: Theme }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center ${
        theme === "dark" ? "bg-[#09111b] text-[#e7f1fb]" : "bg-[#f2f7fc] text-[#10243a]"
      }`}
    >
      <div className="flex flex-col items-center gap-3 text-sm font-medium opacity-80">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span>Loading...</span>
      </div>
    </div>
  );
}

// 🆕 內部組件 - 用於訪問 AuthContext
function RootLayoutClientContent({
  children,
  initialUser,
  pathname,
  locale,
}: RootLayoutClientProps & { pathname: string; locale: string }) {
  const { isMenuButtonVisible, setIsMenuButtonVisible } = useMenuVisibility();
  const { scrollY } = useScroll();
  const t = useTranslations("common");
  const { authenticatedRequest, loading, user, userPoint } = useAuth();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const hasTriggeredLoginRedirectRef = useRef(false);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCopyrightNoticeDialogOpen, setIsCopyrightNoticeDialogOpen] =
    useState(false);
  const [openPaymentModel, setOpenPaymentModel] = useState(false); // 🔑 伺服器端統一為 false
  const [isSettingOpen, setIsSettingOpen] = useState(false); // 🔑 伺服器端統一為 false
  const [callBackDialog, setCallBackDialog] = useState<boolean>(false);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  const [settingTab, setSettingTab] = useState("general");
  const [hasProcessedSuccess, setHasProcessedSuccess] = useState(false);
  // 🆕 從 UpgradePopupAd 傳入的初始標籤和方案（已廢棄，改用直接顯示付款確認對話框）
  const [paymentInitialTab, setPaymentInitialTab] = useState<"yearly" | "monthly" | "points" | undefined>(undefined);
  const [paymentInitialPlan, setPaymentInitialPlan] = useState<"plus" | "pro" | "max" | "payg" | undefined>(undefined);
  // 🆕 付款確認對話框相關狀態
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [orderData, setOrderData] = useState<OrderPreviewData | null>(null);
  const [, setIsLoadingOrderPreview] = useState(false);
  const searchString = searchParams.toString();
  const currentUrl = `${pathname}${searchString ? `?${searchString}` : ""}`;
  const loginCallbackUrl =
    pathname === `/${locale}` || pathname === "/"
      ? `/${locale}/drawing`
      : currentUrl;
  const normalizePath = (value: string) =>
    value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
  const currentPath = normalizePath(pathname || "/");
  const loginPath = normalizePath(`/${locale}/login`);
  const authPagePaths = [
    loginPath,
    `/${locale}/forgot-password`,
    `/${locale}/reset-password`,
  ].map(normalizePath);
  const isAuthPage = authPagePaths.includes(currentPath);
  const shouldBlockProtectedPage = !isAuthPage && (loading || !user);

  const checkIfMobile = useCallback(() => {
    setIsCollapsed(window.innerWidth < MOBILE_BREAKPOINT);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
  }, []);

  // 🆕 處理支付確認
  const handlePaymentConfirm = async () => {
    if (!orderData) return;

    // console.log('💳 開始處理支付:', orderData);
    
    try {
      const response = await authenticatedRequest(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/create-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionType: orderData.transactionType,
            path: pathname,
          }),
        }
      );

      if (!response) {
        throw new Error("No response from server");
      }

      const result = await response.json();
      // console.log('✅ Checkout session created:', result);

      if (result.url) {
        // 重定向到 Stripe checkout 頁面
        window.location.href = result.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
        // console.error("❌ 支付處理失敗:", error);
      showToast(
        locale === "zh-TW"
          ? "支付處理失敗，請稍後再試"
          : "Payment processing failed, please try again later"
      );
    }
  };

  useLayoutEffect(() => {
    if (typeof window !== "undefined" && !hasProcessedSuccess) {
      const hash = window.location.hash;
      const search = window.location.search;

      // console.log("🔍 URL Debug Info:", {
      //   hash,
      //   search,
      //   hasProcessedSuccess,
      //   pathname: window.location.pathname,
      // });

      const hasPricingHash = hash === "#pricing";
      const hasSuccessHash = hash.startsWith("#success");

      if (hasPricingHash) {
        setOpenPaymentModel(true);
      }

      if (hasSuccessHash) {
        // 🔑 立即設置 hasProcessedSuccess，防止重複執行
        setHasProcessedSuccess(true);

        // 提取 session_id
        let sessionId = "";
        if (hash.includes("session_id=")) {
          const hashParams = hash.split("?")[1] || "";
          sessionId = new URLSearchParams(hashParams).get("session_id") || "";
        } else if (search.includes("session_id=")) {
          sessionId = new URLSearchParams(search).get("session_id") || "";
        }

        // console.log("💳 Payment success detected with session:", sessionId);

        // 只有在有 session_id 的情況下才清理 URL
        if (sessionId) {
          // 🔥 使用 setTimeout 確保狀態更新完成後再清理 URL
          setTimeout(() => {
            const cleanUrl = `${window.location.pathname}#success`;
            window.history.replaceState({}, "", cleanUrl);
            // console.log("🧹 URL cleaned to:", cleanUrl);
          }, 0);
        }
        if (!sessionId) {
          return;
        }

        // 顯示成功訊息
        showToast(t("payment_success") || "付款成功！");
        setSettingTab("orders");
        setIsSettingOpen(true);
      }
    }
  }, [t]);

  useEffect(() => {
    const targetLoginUrl = `/${locale}/login?callbackUrl=${encodeURIComponent(loginCallbackUrl)}`;

    if (isAuthPage) {
      hasTriggeredLoginRedirectRef.current = false;
      return;
    }

    if (loading) {
      return;
    }

    if (user) {
      hasTriggeredLoginRedirectRef.current = false;
      return;
    }

    if (hasTriggeredLoginRedirectRef.current) {
      return;
    }

    if (currentPath === loginPath) {
      return;
    }

    hasTriggeredLoginRedirectRef.current = true;
    router.replace(targetLoginUrl);
  }, [
    currentPath,
    isAuthPage,
    loading,
    locale,
    loginCallbackUrl,
    loginPath,
    router,
    user,
  ]);

  useEffect(() => {
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);

    // 🆕 自定義事件監聽器 - 處理從 UpgradePopupAd 傳來的方案和計費週期
    const handleOpenPaymentDialog = async (event: Event) => {
      const customEvent = event as CustomEvent<{ plan: "plus" | "pro" | "max" | "payg"; billingCycle: "monthly" | "yearly" | "points" }>;
      if (customEvent.detail) {
        const { plan, billingCycle } = customEvent.detail;
        // console.log('🎯 從 UpgradePopupAd 收到升級請求:', { plan, billingCycle });
        
        // 🆕 直接獲取訂單預覽並顯示付款確認對話框
        setIsLoadingOrderPreview(true);
        try {
          // 構建 transactionType
          const upperPlan = plan.toUpperCase();
          const transactionType = billingCycle === 'yearly' ? `${upperPlan}_YEAR` : upperPlan;
          
          // console.log('📡 獲取訂單預覽:', { transactionType, locale });
          
          // 調用 API
          const response = await authenticatedRequest(
            `${process.env.NEXT_PUBLIC_SERVER_URL}/order-preview?transactionType=${transactionType}&locale=${locale}`
          );

          if (!response) {
            throw new Error("Failed to fetch order preview");
          }

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
          }

          const data = await response.json();
          // console.log('✅ 訂單預覽獲取成功:', data);
          
          setOrderData(data);
          setShowPaymentConfirmation(true);
        } catch (error) {
          // console.error("❌ 獲取訂單預覽失敗:", error);
          showToast(
            locale === "zh-TW"
              ? "獲取訂單信息失敗，請稍後再試"
              : "Failed to get order information, please try again later"
          );
        } finally {
          setIsLoadingOrderPreview(false);
        }
      } else {
        // 兼容舊的事件格式（沒有 detail）
        setOpenPaymentModel(true);
      }
    };

    window.addEventListener("openPaymentDialog", handleOpenPaymentDialog);

    return () => {
      window.removeEventListener("resize", checkIfMobile);
      window.removeEventListener("openPaymentDialog", handleOpenPaymentDialog);
    };
  }, [checkIfMobile]);

  // 🆕 監聽打開設定對話框並切換到指定 tab 的事件
  useEffect(() => {
    const handleOpenSettingsWithTab = (event: CustomEvent) => {
      const { tab } = event.detail;
      setSettingTab(tab || "general");
      setIsSettingOpen(true);
    };

    window.addEventListener('openSettingsWithTab', handleOpenSettingsWithTab as EventListener);
    
    return () => {
      window.removeEventListener('openSettingsWithTab', handleOpenSettingsWithTab as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleOpenLoginDialog = () => {
      setIsDialogOpen(true);
    };

    window.addEventListener("openLoginDialog", handleOpenLoginDialog);

    return () => {
      window.removeEventListener("openLoginDialog", handleOpenLoginDialog);
    };
  }, []);

  // 監聽滾動狀態變化來控制漢堡按鈕
  useEffect(() => {
    // 如果有 dialog 打開，隱藏選單
    if (
      isDialogOpen ||
      isCopyrightNoticeDialogOpen ||
      openPaymentModel ||
      isSettingOpen
    ) {
      if (isMenuButtonVisible) {
        setIsMenuButtonVisible(false);
      }
      return;
    }

    // 如果不是行動版或側邊欄展開，不處理
    if (!isMobile || !isCollapsed) {
      return;
    }

    // 根據滾動方向控制漢堡按鈕
    const isScrollingDown = scrollY > lastScrollY;
    const isScrollingUp = scrollY < lastScrollY;

    if (isScrollingDown && scrollY > 50) {
      //console.log('向下滾動且超過50px，隱藏漢堡按鈕');
      setIsMenuButtonVisible(false);
    } else if (isScrollingUp) {
      //console.log('向上滾動，顯示漢堡按鈕');
      setIsMenuButtonVisible(true);
    }

    // 更新上一次滾動位置
    setLastScrollY(scrollY);
  }, [
    scrollY,
    lastScrollY,
    isMobile,
    isCollapsed,
    isDialogOpen,
    isCopyrightNoticeDialogOpen,
    openPaymentModel,
    isSettingOpen,
    isMenuButtonVisible,
    setIsMenuButtonVisible,
  ]);

  const toggleSidebar = useCallback(
    (e: React.MouseEvent<HTMLButtonElement> | null) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      setIsCollapsed((prev) => {
        // 當側邊欄展開時，確保漢堡選單可見
        if (prev) {
          setIsMenuButtonVisible(true);
        }
        return !prev;
      });
    },
    [setIsMenuButtonVisible]
  );

  const toggleCloseSidebar = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (!isMobile) {
        return;
      }
      setIsCollapsed(true);
    },
    [isMobile]
  );

  // 處理 resize 事件
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimeout);

      resizeTimeout = setTimeout(() => {
        checkIfMobile();

        // 如果在 resize 後變成桌面版，且沒有 dialog 打開，重置選單狀態
        if (
          window.innerWidth >= MOBILE_BREAKPOINT &&
          !isDialogOpen &&
          !isCopyrightNoticeDialogOpen &&
          !openPaymentModel &&
          !isSettingOpen
        ) {
          setIsMenuButtonVisible(true);
        }
      }, 100);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [
    checkIfMobile,
    isDialogOpen,
    isCopyrightNoticeDialogOpen,
    openPaymentModel,
    isSettingOpen,
    setIsMenuButtonVisible,
  ]);

  return (
    <>
      <div
        className={`flex h-screen overflow-hidden w-full ${
          theme === "dark" ? "bg-transparent" : "bg-transparent"
        }`}
        onClick={toggleCloseSidebar}
      >
        <DesktopSidebar
          isCollapsed={isCollapsed}
          toggleSidebar={toggleSidebar}
          setIsDialogOpen={setIsDialogOpen}
          toggleTheme={toggleTheme}
          theme={theme}
          openPaymentModel={openPaymentModel}
          // setOpenPaymentModel={(openPaymentModel: boolean) => {
          //   setOpenPaymentModel(openPaymentModel);
          // }}
          setIsSettingOpen={(openSetting: boolean) => {
            setIsSettingOpen(openSetting);
          }}
        />
        <MobileSidebar
          isOpen={isCollapsed}
          toggleSidebar={toggleSidebar}
          setIsDialogOpen={setIsDialogOpen}
          theme={theme}
          setIsSettingOpen={(openSetting: boolean) => {
            setIsSettingOpen(openSetting);
          }}
        />
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ease-in-out w-full ${
            isCollapsed ? "ml-0 md:ml-[60px]" : "ml-0 md:ml-[240px]"
          } ${theme === "dark" ? "bg-transparent" : "bg-transparent"}`}
        >
          <button
            onClick={toggleSidebar}
            className={`fixed block md:hidden top-3 left-2 z-20 rounded-2xl bg-white/86 px-2.5 py-2 text-gray-500 shadow-sm backdrop-blur-sm dark:bg-[#0f1722]/86 dark:text-custom-white transition-all duration-300 ease-in-out ${
              isMenuButtonVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 pointer-events-none"
            }`}
            aria-label="Toggle menu"
          >
            <span className="inline-flex items-center gap-[14px]">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center">
                <Image
                  src="/images/logo-small.svg"
                  alt="超星AI平台"
                  width={22}
                  height={22}
                  className="block object-contain"
                  priority
                />
              </span>
              <span className="text-[12px] font-semibold leading-none text-[#10243a] dark:text-white">
                Superstar
              </span>
            </span>
          </button>
          {shouldBlockProtectedPage ? (
            <AuthLoadingScreen theme={theme} />
          ) : (
            children
          )}
        </div>
      </div>
      <LoginDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        callbackUrl={loginCallbackUrl}
      />

      <CopyrightNoticeDialog
        isOpen={isCopyrightNoticeDialogOpen}
        onClose={() => setIsCopyrightNoticeDialogOpen(false)}
        onAgree={() => {
          // console.log("🔥 條款同意，處理後續邏輯");
          localStorage.setItem("termsAgreed", "true");
          setIsCopyrightNoticeDialogOpen(false);
          // 如果 PaymentModelDialog 開著，說明是從那裡觸發的
          if (openPaymentModel) {
            setOpenPaymentModel(false);
            // 等 PaymentModelDialog 關閉後再跳登入
            setTimeout(() => {
              setIsDialogOpen(true);
            }, 300);
          }
        }}
      />
      <PaymentModelDialog
        path={pathname}
        isOpen={openPaymentModel}
        initialTab={paymentInitialTab}
        initialPlan={paymentInitialPlan}
        skipUpgradeConfirm={!!paymentInitialPlan}
        onClose={function (): void {
          setOpenPaymentModel(false);
          // 🆕 清除初始標籤和方案
          setPaymentInitialTab(undefined);
          setPaymentInitialPlan(undefined);
          if (callBackDialog) {
            setIsSettingOpen(true);
            setCallBackDialog(false);
          }
        }}
        onSelectPlan={function (): void {
          // return console.log(plan);
        }}
        setIsDialogOpen={setIsDialogOpen}
        onStandardPlanClick={function (): void {
          // console.log("🔥 父組件處理免費方案點擊");
          // 檢查是否已經同意過條款
          if (localStorage.getItem("termsAgreed") === "true") {
            // 已同意，先關閉 PaymentDialog，然後直接跳登入
            // console.log("✅ 已同意條款，先關閉 PaymentDialog，然後直接跳登入");
            setOpenPaymentModel(false);
            // 在 PaymentModelDialog 完全關閉後再跳登入
            if (!initialUser) {
              setTimeout(() => {
                setIsDialogOpen(true);
              }, 300);
            }
          } else {
            // 沒同意，開啟條款對話框
            // console.log("❌ 沒同意條款，開啟條款對話框");
            setIsCopyrightNoticeDialogOpen(true);
          }
        }}
      />
      <SettingDialog
        isOpen={isSettingOpen}
        tab={settingTab}
        onClose={() => setIsSettingOpen(false)}
        setOpenPaymentModel={(openPaymentModel: boolean) => {
          setIsSettingOpen(false);
          setOpenPaymentModel(openPaymentModel);
          setCallBackDialog(true);
        }}
      />
      
      {/* 🆕 付款確認對話框 - 從 UpgradePopupAd 直接跳轉到這裡 */}
      {showPaymentConfirmation && orderData && (
        <PaymentConfirmationDialog
          isOpen={showPaymentConfirmation}
          onClose={() => {
            setShowPaymentConfirmation(false);
            setOrderData(null);
          }}
          onConfirm={handlePaymentConfirm}
          orderData={orderData}
          userPoint={userPoint}
        />
      )}
    </>
  );
}

// 🆕 外層組件 - 提供 AuthProvider
function RootLayoutClientInner(props: RootLayoutClientProps) {
  const pathname = usePathname();
  const locale = useLocale();
  
  return (
    <AuthProvider initialUser={props.initialUser}>
      <RootLayoutClientContent 
        {...props} 
        pathname={pathname}
        locale={locale}
      />
    </AuthProvider>
  );
}

export default function RootLayoutClient(props: RootLayoutClientProps) {
  return (
    <MenuVisibilityProvider>
      <ScrollProvider>
        <RootLayoutClientInner {...props} />
      </ScrollProvider>
    </MenuVisibilityProvider>
  );
}
