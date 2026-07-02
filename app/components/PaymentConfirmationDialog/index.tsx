import React, { useState, useEffect } from "react";
import { X, CreditCard } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { UserPoint } from "@/payload-types";

// 🎯 簡化的付款確認對話框介面
interface PaymentConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userPoint: UserPoint | null;
  orderData: {
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
}

const PaymentConfirmationDialog: React.FC<PaymentConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  orderData,
  userPoint,
}) => {
  const locale = useLocale();
  const t = useTranslations("payment");
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible && !isOpen) return null;

  const isSubscription = !!orderData.subscriptionInfo;

  // 🎯 簡化的金額計算 - 直接使用顯示金額
  const calculateAmountDisplay = () => {
    const totalAmount = parseFloat(
      (orderData.displayAmount || "$0").replace("$", "")
    );

    // 處理 proration（按比例退費）
    const prorationAmount = orderData.proration
      ? Math.abs(orderData.proration.credit / 100)
      : 0;

    // 最終總價（原價 - 退費）
    const finalTotal = totalAmount - prorationAmount;

    return {
      originalAmount: totalAmount,
      prorationAmount: prorationAmount,
      finalTotal: finalTotal,
    };
  };

  const amountDisplay = calculateAmountDisplay();

  return (
    <div
      className={`fixed inset-0 z-[10001] flex justify-center items-center overflow-hidden outline-none focus:outline-none transition-opacity duration-300 ease-in-out ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm transition-opacity duration-300 ease-in-out"
        onClick={onClose}
      ></div>

      <div
        className={`relative w-full max-w-md mx-4 transition-all duration-300 ease-in-out ${
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t("confirm_changes")}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Plan Details */}
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {orderData.title === "PLUS" 
                      ? t("plus_plan")
                      : orderData.title === "PRO"
                      ? t("pro_plan")
                      : orderData.title === "MAX"
                      ? t("max_plan")
                      : orderData.title === "PAYG"
                      ? t("payg_plan")
                      : orderData.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {isSubscription
                      ? (() => {
                          const billingCycle = orderData.subscriptionInfo?.billingCycle;
                          // 檢查是否為中文 "每月計費，從今天開始"
                          if (billingCycle?.includes("每月計費") || billingCycle?.includes("從今天開始")) {
                            return t("billing_from_today");
                          }
                          // 檢查是否為英文 "Monthly billing, starting today"
                          if (billingCycle?.includes("Monthly billing") || billingCycle?.includes("starting today")) {
                            return t("billing_from_today");
                          }
                          // 檢查是否為日文
                          if (billingCycle?.includes("月額請求") || billingCycle?.includes("本日から開始")) {
                            return t("billing_from_today");
                          }
                          // 如果都不匹配，返回原值
                          return billingCycle || "";
                        })()
                      : orderData.purchaseInfo?.description?.includes("PAYG")
                      
                      ? t("no_expiration")
                      : orderData.purchaseInfo?.description}
                  </p>
                  {/* 🆕 當有 billingCycle 時顯示現在時間 */}
                  {isSubscription && orderData.subscriptionInfo?.billingCycle && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {t("current_time")}
                      {new Date().toLocaleString(locale === "zh-TW" ? "zh-TW" : "en-US", {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {orderData.displayAmount}
                  </span>
                </div>
              </div>

              {/* Proration Credit */}
              {orderData.proration && (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex-1">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t("adjustment")}
                    </span>
                    <br />
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {orderData.proration.description}
                    </span>
                  </div>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {orderData.proration.displayCredit}
                  </span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700"></div>

            {/* 🎯 簡化的總計顯示 */}
            <div className="space-y-3">
              {/* 如果有 proration，顯示調整前後的金額 */}
              {orderData.proration ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t("original_price")}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      ${amountDisplay.originalAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t("adjustment")}
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      -${amountDisplay.prorationAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-base border-t border-gray-200 dark:border-gray-700 pt-3">
                    <span className="text-gray-900 dark:text-white">
                      {t("total_due_today")}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      ${amountDisplay.finalTotal.toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                /* 沒有 proration 時，直接顯示總計 */
                <div className="flex justify-between font-semibold text-lg">
                  <span className="text-gray-900 dark:text-white">
                    {t("total_due_today")}
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {orderData.displayAmount}
                  </span>
                </div>
              )}

              {/* 🎯 簡化的價格說明 */}
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {t("price_includes_tax")}
              </div>
            </div>

            {/* Points Change Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                {t("points_change")}
              </h5>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {(() => {
                  // 處理點數變更描述的中英文切換
                  const description = orderData.pointsChange.description;
                  const before = orderData.pointsChange.before;
                  const added = orderData.pointsChange.added;
                  const extraPoints = userPoint?.extraPoints || 0;
                  const total = before + extraPoints + added;
                  
                  console.log('🔍 Points calculation:', {
                    before,
                    extraPoints,
                    total,
                    userPoint,
                    description
                  });
                  
                  // 檢查是否包含「點數重置為」
                  if (description.includes('點數重置為') || description.includes('Points reset to')) {
                    const number = description.replace('點數重置為 ', '').replace('Points reset to ', '');
                    return t("points_reset_to", { number });
                  }
                  
                  // 其他情況保持原樣
                  // return locale === "zh-TW" 
                  //   ? `點數：${before + extraPoints} → ${before + extraPoints + added} (+${added})`
                  //   : `Points: ${before + extraPoints} → ${before + extraPoints + added} (+${added})`;

                })()}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {t("status_change")}:{" "}
                {(() => {
                  // 轉換方案名稱的函數
                  const getPlanName = (plan: string) => {
                    if (locale === "zh-TW") {
                      switch (plan) {
                        case "FREE": return t("free_plan");
                        case "PLUS": return t("plus_plan_short");
                        case "PRO": return t("pro_plan_short");
                        case "MAX": return t("max_plan_short");
                        case "PAYG": return t("payg_plan_short");
                        default: return plan;
                      }
                    } else {
                      switch (plan) {
                        case "FREE": return "Basic";
                        case "PLUS": return "PLUS";
                        case "PRO": return "PRO";
                        case "MAX": return "MAX";
                        case "PAYG": return "Pay As You Go";
                        default: return plan;
                      }
                    }
                  };

                  // 解析 statusChange 格式
                  const statusChange = orderData.statusChange;
                  
                  // 處理 "FREE → PLUS" 格式
                  if (statusChange.includes(" → ")) {
                    const parts = statusChange.split(" → ");
                    if (parts.length === 2) {
                      const fromPlan = parts[0];
                      const toPlan = parts[1];
                      return `${getPlanName(fromPlan)} → ${getPlanName(toPlan)}`;
                    }
                  }
                  
                  // 處理 "MAX (繼續累積)" 格式
                  if (statusChange.includes(" (")) {
                    const planMatch = statusChange.match(/^([A-Z]+)\s*\(([^)]+)\)$/);
                    if (planMatch) {
                      const planName = planMatch[1];
                      const description = planMatch[2];
                      
                      // 轉換描述文字
                      let translatedDescription = description;
                      if (locale === "zh-TW") {
                        if (description === "繼續累積") {
                          translatedDescription = t("continue_accumulating");
                        } else if (description === "Continue accumulating") {
                          translatedDescription = t("continue_accumulating");
                        }
                      } else {
                        if (description === "繼續累積") {
                          translatedDescription = t("continue_accumulating");
                        } else if (description === "Continue accumulating") {
                          translatedDescription = "Continue accumulating";
                        }
                      }
                      
                      return `${getPlanName(planName)} (${translatedDescription})`;
                    }
                  }
                  
                  // 如果格式不符合預期，嘗試轉換單個方案名稱
                  const planMatch = statusChange.match(/^([A-Z]+)$/);
                  if (planMatch) {
                    return getPlanName(planMatch[1]);
                  }
                  
                  // 如果都不符合，返回原始值
                  return statusChange;
                })()}
              </p>
            </div>

            {/* Payment Method */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t("payment_method")}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {orderData.paymentMethod?.displayText ||
                        t("default_payment_method")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200 font-medium disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200 font-medium disabled:opacity-50 flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  t("pay_now")
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmationDialog;