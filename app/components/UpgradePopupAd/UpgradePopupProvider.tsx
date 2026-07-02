"use client";

import React, { createContext, useContext } from "react";
import { useUpgradePopup } from "@/app/hooks/useUpgradePopup";
import UpgradePopupAd from "./index";
// import ManualTrigger from "./ManualTrigger";
type BillingCycle = "monthly" | "yearly" | "points";
type PlanType = "plus" | "pro" | "max" | "payg";

interface UpgradePopupContextType {
  isPopupOpen: boolean;
  showPopup: () => void;
  forceShowPopup: () => void;
  hidePopup: () => void;
  openPaymentDialog?: (plan: PlanType, billingCycle: BillingCycle) => void;
}

// 創建 Context
const UpgradePopupContext = createContext<UpgradePopupContextType | null>(null);

// 導出 hook 供子組件使用
export const useUpgradePopupContext = () => {
  const context = useContext(UpgradePopupContext);
  if (!context) {
    throw new Error('useUpgradePopupContext must be used within UpgradePopupProvider');
  }
  return context;
};

interface UpgradePopupProviderProps {
  children: React.ReactNode;
}

const UpgradePopupProvider: React.FC<UpgradePopupProviderProps> = ({
  children,
}) => {

  const { isPopupOpen, showPopup, forceShowPopup, hidePopup } = useUpgradePopup();

  // 調試：監控 isPopupOpen 狀態變化
  // React.useEffect(() => {
  //   console.log('🔍 UpgradePopupProvider - isPopupOpen 變化:', isPopupOpen);
  // }, [isPopupOpen]);

  // 🆕 處理升級按鈕點擊 - 接收方案和計費週期
  const handleUpgradeClick = (plan: PlanType, billingCycle: BillingCycle) => {
    // 觸發自定義事件，讓 RootLayoutClient 監聽並打開 PaymentModelDialog
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openPaymentDialog', {
        detail: { plan, billingCycle }
      }));
    }
  };

  // 調試信息 - 在開發環境中顯示
  if (process.env.NODE_ENV === 'development') {
    // console.log('UpgradePopupProvider Debug:', {
    //   user: !!user,
    //   userPoint: userPoint,
    //   point: point,
    //   shouldShowPopup,
    //   isPopupOpen,
    //   pointType: userPoint?.pointType
    // });
  }

  // 始終渲染彈窗組件（用於推廣目的）
  // 移除用戶登入檢查，讓彈窗可以為所有用戶顯示
  // console.log("UpgradePopupProvider: Rendering for all users");

  return (
    <UpgradePopupContext.Provider value={{ isPopupOpen, showPopup, forceShowPopup, hidePopup, openPaymentDialog: handleUpgradeClick }}>
      {children}
      {/* 始終渲染彈窗，即使用戶未登入（用於推廣） */}
      <UpgradePopupAd
        isOpen={isPopupOpen}
        onClose={hidePopup}
        onUpgradeClick={handleUpgradeClick}
      />
      {/* 在開發環境中顯示調試信息 */}
      {process.env.NODE_ENV === 'development' && (
        <>
          {/* <ManualTrigger /> */}
        </>
      )}
    </UpgradePopupContext.Provider>
  );
};

export default UpgradePopupProvider;
