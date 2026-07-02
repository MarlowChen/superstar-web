"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { X, Zap, CheckCircle } from "lucide-react";

interface UpgradePopupAdProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgradeClick: (plan: PlanType, billingCycle: BillingCycle) => void;
}

type BillingCycle = "monthly" | "yearly" | "points";
type PlanType = "plus" | "pro" | "max" | "payg";

const UpgradePopupAd: React.FC<UpgradePopupAdProps> = ({
  isOpen,
  onClose,
  onUpgradeClick,
}) => {
  const t = useTranslations("upgrade");
  const [isVisible, setIsVisible] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("plus");

  useEffect(() => {
    // console.log('UpgradePopupAd: isOpen changed to', isOpen);
    if (isOpen) {
      // 延遲顯示動畫
      // console.log('UpgradePopupAd: Setting visible in 100ms');
      const timer = setTimeout(() => {
        setIsVisible(true);
        // console.log('UpgradePopupAd: Now visible');
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpgradeClick = () => {
    // 🆕 傳遞選擇的方案和計費週期
    onUpgradeClick(selectedPlan, billingCycle);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const plans = {
    plus: {
      name: t("plus_plan_name"),
      monthlyPrice: 10,
      yearlyPrice: 8,
      features: [
        t("plus_feature_1"),
        t("plus_feature_2"),
        t("plus_feature_3"),
        t("plus_feature_4"),
        t("plus_feature_5"),
        t("plus_feature_6"),
      ],
    },
    pro: {
      name: t("pro_plan_name"),
      monthlyPrice: 30,
      yearlyPrice: 24,
      // tokens: "22,000",
      // rollover: "66,000",
      features: [
        t("pro_feature_1"),
        t("pro_feature_2"),
        t("pro_feature_3"),
        t("pro_feature_4"),
        t("pro_feature_5"),
        t("pro_feature_6"),
        t("pro_feature_7"),
      ],
    },
    max: {
      name: t("max_plan_name"),
      monthlyPrice: 60,
      yearlyPrice: 48,
      features: [
        t("max_feature_1"),
        t("max_feature_2"),
        t("max_feature_3"),
        t("max_feature_4"),
        t("max_feature_5"),
        t("max_feature_6"),
        t("max_feature_7"),
      ],
    },
    payg: {
      name: t("payg_plan_name"),
      monthlyPrice: 50,
      yearlyPrice: null, // PAYG 沒有年度價格概念
      features: [
        t("payg_feature_1"),
        t("payg_feature_2"),
        t("payg_feature_3"),
        t("payg_feature_4"),
        t("payg_feature_5"),
        t("payg_feature_6"),
        t("payg_feature_7"),
      ],
    },
  };

  const currentPlan = plans[selectedPlan];

  // 方案圖片映射
  const planImages = {
    plus: "/images/plus.jpg",
    pro: "/images/pro.jpg", 
    max: "/images/max.jpg",
    payg: "/images/payg.jpg"
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={`relative w-full max-w-[min(calc(100%-1rem),62.5rem)] sm:max-w-[min(calc(100%-1.25rem),62.5rem)] max-h-[95vh] transform rounded-2xl sm:rounded-3xl border border-purple-500/30 dark:border-purple-500/30 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 shadow-2xl transition-all duration-300 overflow-hidden ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="flex flex-col lg:flex-row h-full max-h-[85vh] lg:min-h-[500px] lg:h-auto">
          {/* 左側圖片區域 */}
          <div className="relative h-32 sm:h-40 lg:h-auto lg:w-2/5 overflow-hidden flex-shrink-0">
            {/* 背景圖片 */}
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-500 ease-in-out"
              style={{
                backgroundImage: `url(${planImages[selectedPlan]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
            {/* 漸層遮罩 */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
            {/* 內容區域 */}
            <div className="relative h-full flex flex-col items-center justify-end pb-4 sm:pb-8 lg:pb-16">
              <div className="mb-2 sm:mb-4 lg:mb-6">
                <Zap className="h-12 w-12 sm:h-16 sm:w-16 lg:h-24 lg:w-24 text-white drop-shadow-lg" />
              </div>
              <div className="text-center px-4">
                <p className="text-base sm:text-xl lg:text-2xl text-white leading-tight">
                  {t("create_endless_imagination")}
                </p>
                <p className="text-xl sm:text-2xl lg:text-4xl font-bold bg-gradient-to-r from-yellow-200 via-pink-200 to-purple-200 bg-clip-text text-transparent">
                  {currentPlan.name}
                </p>
              </div>
            </div>
          </div>

          {/* 右側內容區域 */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* 主題切換和關閉按鈕 */}
            <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 flex gap-2">
              <button
                onClick={onClose}
                className="rounded-full p-1.5 sm:p-2 text-gray-600 hover:bg-gray-200/50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-white transition-colors"
                aria-label={t("close")}
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {/* 主要內容 */}
            <div className="flex-1 p-4 sm:p-6 lg:p-12 overflow-y-auto">
              {/* 標題 */}
              <div className="text-center mb-4 sm:mb-6">
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                  {t("you_unlock_more_creative_freedom")}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {t("your_points_are_about_to_run_out")}
                </p>
              </div>

              {/* 計費週期切換 */}
              <div className="mb-4 sm:mb-6">
                <div className="relative flex items-center justify-center gap-1 sm:gap-2 p-1 bg-gray-200/50 dark:bg-gray-800/50 rounded-lg">
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`flex-1 py-2 sm:py-2.5 px-1 sm:px-2 rounded-md font-medium transition-all duration-200 ${
                      billingCycle === "yearly"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                        : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                    }`}
                    title={t("select_yearly_plan")}
                  >
                    <span className="text-xs sm:text-sm">{t("yearly_plan")}</span>
                  </button>
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`flex-1 py-2 sm:py-2.5 px-1 sm:px-2 rounded-md font-medium transition-all duration-200 ${
                      billingCycle === "monthly"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                        : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                    }`}
                    title={t("select_monthly_plan")}
                  >
                    <span className="text-xs sm:text-sm">{t("monthly_plan")}</span>
                  </button>
                  <button
                    onClick={() => setBillingCycle("points")}
                    className={`flex-1 py-2 sm:py-2.5 px-1 sm:px-2 rounded-md font-medium transition-all duration-200 ${
                      billingCycle === "points"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                        : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                    }`}
                    title={t("select_points_plan")}
                  >
                    <span className="text-xs sm:text-sm">{t("points_plan")}</span>
                  </button>
                </div>
              </div>

              {/* 方案選擇 */}
              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                {(Object.keys(plans) as PlanType[])
                  .filter(planKey => {
                    // 點數模式下只顯示 PAYG 方案
                    if (billingCycle === "points") {
                      return planKey === "payg";
                    }
                    // 年付和月付模式下隱藏 PAYG 方案，因為 PAYG 沒有年度/月付價格
                    if ((billingCycle === "yearly" || billingCycle === "monthly") && planKey === "payg") {
                      return false;
                    }
                    return true;
                  })
                  .map((planKey) => {
                  const plan = plans[planKey];
                  const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
                  const originalPrice = billingCycle === "yearly" ? plan.monthlyPrice : null;
                  const hasDiscount = !!(originalPrice && price && price < originalPrice);
                  const discountPercent = hasDiscount
                    ? Math.round((1 - (price as number) / (originalPrice as number)) * 100)
                    : 0;
                  
                  return (
                    <button
                      key={planKey}
                      onClick={() => setSelectedPlan(planKey)}
                      className={`w-full p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all duration-200 text-left ${
                        selectedPlan === planKey
                          ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20"
                          : "border-gray-300 bg-gray-100/50 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-800/30 dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div
                            className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              selectedPlan === planKey
                                ? "border-purple-500 bg-gradient-to-r from-purple-500 to-pink-500"
                                : "border-gray-400 dark:border-gray-600"
                            }`}
                          >
                            {selectedPlan === planKey && (
                              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white" />
                            )}
                          </div>
                          <span className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white uppercase">{plan.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            {hasDiscount && (
                              <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                                {t("discount_off", { percent: discountPercent })}
                              </span>
                            )}
                            {originalPrice && (
                              <span className="text-xs sm:text-sm text-gray-500 line-through">
                                ${originalPrice}
                              </span>
                            )}
                            <span className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white">
                              ${price}
                            </span>
                          </div>
                          <span className="text-[10px] sm:text-xs text-gray-400">
                            / {planKey === "payg" ? t("payg_plan_duration") : t(billingCycle === "yearly" ? "yearly_plan" : "monthly_plan")}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 功能列表 */}
              <div className="bg-gray-100/50 dark:bg-gray-800/30 rounded-lg sm:rounded-xl p-3 sm:p-5 border border-gray-300/50 dark:border-gray-700/50">
                <ul className="space-y-2 sm:space-y-3">
                  {currentPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 sm:gap-3">
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 底部按鈕 */}
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center justify-center gap-2 sm:gap-3 lg:gap-4 p-3 sm:p-4 lg:p-6 border-t border-gray-300/50 dark:border-gray-700/50 bg-gray-100/30 dark:bg-gray-800/30 flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg border border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm sm:text-base font-medium hover:bg-gray-200/50 hover:text-gray-800 dark:hover:bg-gray-700/50 dark:hover:text-white transition-all duration-200 w-full xs:flex-1 xs:max-w-[280px]"
              >
                {t("maybe_later")}
              </button>
              <button
                onClick={handleUpgradeClick}
                className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm sm:text-base font-semibold hover:from-purple-600 hover:to-pink-600 hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-200 w-full xs:flex-1 xs:max-w-[280px]"
              >
                {t("upgrade_now")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradePopupAd;
