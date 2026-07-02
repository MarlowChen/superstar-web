import React, { useState, useEffect, useCallback } from "react";
import { X, Check, ArrowUp, ArrowDown } from "lucide-react";
import { useTranslations } from "next-intl";
import CopyrightNoticeDialog from "../CopyrightNoticeDialog";
import { useAuth } from "@/app/context/AuthContext";
import PaymentConfirmationDialog from "../PaymentConfirmationDialog";
import { showToast } from "../CustomToast";

// 定義訂閱狀態的類型
interface ActiveSubscription {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number; // Unix timestamp
  status?: string;
  planType?: string;
}

// 定義 orderData 的類型 - 根據 PaymentConfirmationDialog 的 props 類型
interface OrderData {
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
  sessionId?: string;
}

// 主要的付款模態對話框
interface ModelDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (plan: "standard" | "plus" | "pro" | "max" | "payg") => void;
  onCloseCallback?: () => void;
  setIsDialogOpen?: (isOpen: boolean) => void;
  onStandardPlanClick?: () => void;
  path: string;
  // 🆕 初始標籤和方案選擇（從 UpgradePopupAd 傳入）
  initialTab?: "yearly" | "monthly" | "points";
  initialPlan?: "plus" | "pro" | "max" | "payg";
  // 🆕 是否直接進入付款流程（從 UpgradePopupAd 來時跳過升級確認對話框）
  skipUpgradeConfirm?: boolean;
}

interface Plan {
  id: "standard" | "plus" | "pro" | "max" | "payg";
  name: string;
  tagline: string;
  subTagline?: string;
  price: string;
  originalPrice?: string | null;
  duration: string;
  buttonText: string;
  features: string[];
  isSubscribed?: boolean;
  isDisabled?: boolean;
  disabledReason?: string;
  isPopular?: boolean;
  // 🆕 升級/降級相關
  canUpgradeTo?: boolean;
  canDowngradeTo?: boolean;
  upgradeType?: 'upgrade' | 'downgrade' | null;
}

const PaymentModelDialog: React.FC<ModelDetailsDialogProps> = ({
  isOpen,
  onClose,
  onCloseCallback,
  setIsDialogOpen,
  onStandardPlanClick,
  path,
  initialTab,
  initialPlan,
  skipUpgradeConfirm,
}) => {
  const { authenticatedRequest, userPoint } = useAuth();
  const t = useTranslations("payment");
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"yearly" | "monthly" | "points">(initialTab || "yearly");

  // 🆕 當 initialTab 改變時，更新 activeTab
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // ==================== 方案類型 Helper Functions ====================
  // 這些函數統一處理方案類型的轉換，讓系統更容易維護

  /** 
   * 從 transactionType 中提取方案類型（不包含計費週期）
   * 例如：'PLUS' -> 'PLUS', 'PLUS_YEAR' -> 'PLUS', 'PRO_YEAR' -> 'PRO'
   */
  const extractPlanType = (transactionType: string): string => {
    if (!transactionType) return "";
    // 移除 _YEAR 後綴
    return transactionType.replace(/_YEAR$/, "").toUpperCase();
  };

  /**
   * 從 transactionType 中提取計費週期
   * 例如：'PLUS' -> 'monthly', 'PLUS_YEAR' -> 'yearly', 'PAYG' -> null
   */
  const extractBillingCycle = (transactionType: string): 'monthly' | 'yearly' | null => {
    if (!transactionType) return null;
    if (transactionType.endsWith('_YEAR')) {
      return 'yearly';
    }
    // PLUS, PRO, MAX 預設為月訂閱
    if (['PLUS', 'PRO', 'MAX'].includes(transactionType.toUpperCase())) {
      return 'monthly';
    }
    return null;
  };
  /**
   * 根據方案類型和計費週期生成 transactionType
   * 例如：('PLUS', 'yearly') -> 'PLUS_YEAR', ('PLUS', 'monthly') -> 'PLUS'
   */
  const buildTransactionType = (planType: string, billingCycle: 'monthly' | 'yearly'): string => {
    const upperPlanType = planType.toUpperCase();
    if (billingCycle === 'yearly') {
      return `${upperPlanType}_YEAR`;
    }
    return upperPlanType;
  };


  /**
   * 判斷是否為當前方案（考慮計費週期）
   * 如果用戶當前是 PLUS（月訂閱），在「年訂閱」標籤看到 PLUS 時，不應該顯示為「當前方案」
   */
  const isCurrentPlan = (planId: string, currentPointType: string | undefined, currentTab: 'yearly' | 'monthly' | 'points'): boolean => {
    if (!currentPointType) return false;
    
    const planType = planId.toUpperCase();
    const currentPlanType = extractPlanType(currentPointType);
    const currentBillingCycle = extractBillingCycle(currentPointType);
    
    // 方案類型必須相同
    if (planType !== currentPlanType) return false;
    
    // 如果是在「年訂閱」標籤，只有當前是年訂閱才算當前方案
    if (currentTab === 'yearly') {
      return currentBillingCycle === 'yearly';
    }
    
    // 如果是在「月訂閱」標籤，只有當前是月訂閱才算當前方案
    if (currentTab === 'monthly') {
      return currentBillingCycle === 'monthly';
    }
    
    return false;
  };

  /**
   * 檢查是否可以升級到指定方案（考慮計費週期）
   * 例如：當前是 PLUS（月訂閱），可以升級到 PLUS_YEAR（年訂閱）
   */
  const canUpgradeToPlan = (planId: string, availableUpgrades: string[]): boolean => {
    const planType = planId.toUpperCase();
    const targetBillingCycle = activeTab === 'yearly' ? 'yearly' : 'monthly';
    const currentPlanType = extractPlanType(subStatus.currentPointType || '');
    const currentBillingCycle = extractBillingCycle(subStatus.currentPointType || '');
    
    // 🆕 特殊情況：從月訂閱升級到年訂閱（同方案不同計費週期）
    // 如果用戶當前是月訂閱，在「年訂閱」標籤看到同一個方案，應該允許升級
    if (
      currentPlanType === planType && 
      currentBillingCycle === 'monthly' && 
      targetBillingCycle === 'yearly'
    ) {
      // console.log('✅ 允許從月訂閱升級到年訂閱:', {
      //   currentPlanType,
      //   currentBillingCycle,
      //   targetPlanType: planType,
      //   targetBillingCycle
      // });
      return true;
    }
    
    // 檢查 availableUpgrades 中是否有匹配的（考慮計費週期）
    const canUpgrade = availableUpgrades.some(upgrade => {
      const upgradePlanType = extractPlanType(upgrade);
      const upgradeBillingCycle = extractBillingCycle(upgrade);
      
      // 方案類型必須相同，且計費週期也要匹配
      return upgradePlanType === planType && upgradeBillingCycle === targetBillingCycle;
    });
    
    // console.log('🔍 canUpgradeToPlan 檢查:', {
    //   planId,
    //   planType,
    //   targetBillingCycle,
    //   currentPlanType,
    //   currentBillingCycle,
    //   availableUpgrades,
    //   canUpgrade
    // });
    
    return canUpgrade;
  };
  const [showCopyrightDialog, setShowCopyrightDialog] = useState(false);
  const [pendingLogin, setPendingLogin] = useState(false);

  // 付款確認對話框相關狀態
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  
  // 🆕 新增升級確認對話框狀態
  const [showUpgradeConfirmDialog, setShowUpgradeConfirmDialog] = useState(false);
  const [pendingUpgradePlan, setPendingUpgradePlan] = useState<{
    planId: string;
    planName: string;
    upgradeType: 'upgrade' | 'downgrade';
  } | null>(null);
  


  // 🔧 修改：擴展用戶狀態
  const [subStatus, setSubStatus] = useState<{
    canSubscribePayg: boolean;
    canSubscribePlus: boolean;
    canSubscribePro: boolean;
    canSubscribeMax: boolean;
    hasActiveSubscription: boolean;
    currentPointType: string;
    currentPeriodEnd?: string | number; // 🆕 添加 currentPeriodEnd 字段
    canUpgrade: boolean;
    availableUpgrades: string[];
    activeSubscription?: ActiveSubscription;
  }>({
    canSubscribePayg: false,
    canSubscribePlus: false,
    canSubscribePro: false,
    canSubscribeMax: false,
    hasActiveSubscription: false,
    currentPointType: "FREE",
    currentPeriodEnd: undefined, // 🆕 添加 currentPeriodEnd
    canUpgrade: false,
    availableUpgrades: [],
  });

  // 獲取當前語言
  const getCurrentLocale = () => {
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      if (pathname.startsWith("/en")) return "en";
      if (pathname.startsWith("/zh")) return "zh";
    }
    return "zh";
  };



  // 🔧 修改：根據訂閱狀態和升級選項生成計劃數據
  const getPlans = (): Plan[] => {
    const locale = getCurrentLocale();

    // 根據當前標籤決定價格顯示
    const getPlanPrice = (planId: string) => {
      if (activeTab === "yearly") {
        // 年訂閱顯示折扣價格
        switch (planId) {
          case "plus":
            return t("plus_plan_yearly_price");
          case "pro":
            return t("pro_plan_yearly_price");
          case "max":
            return t("max_plan_yearly_price");
          default:
            return t(`${planId}_plan_price`);
        }
      } else {
        // 月訂閱顯示原價
        return t(`${planId}_plan_price`);
      }
    };

    const getOriginalPrice = (planId: string) => {
      if (activeTab === "yearly") {
        switch (planId) {
          case "plus":
            return t("plus_plan_monthly_price");
          case "pro":
            return t("pro_plan_monthly_price");
          case "max":
            return t("max_plan_monthly_price");
          default:
            return null;
        }
      }
      return null;
    };

    return [
      {
        id: "standard",
        name: t("standard_plan_name"),
        tagline: t("standard_plan_tagline"),
        price: t("standard_plan_price"),
        duration: t("standard_plan_duration"),
        buttonText: t("standard_plan_button"),
        features: [
          t("standard_feature_1"),
          t("standard_feature_2"),
          t("standard_feature_3"),
          t("standard_feature_4"),
        ],
        isSubscribed: subStatus.currentPointType === "FREE",
        isDisabled: false,
      },
      {
        id: "plus",
        name: t("plus_plan_name"),
        tagline: t("plus_plan_tagline"),
        subTagline: t("plus_plan_subtagline"),
        price: getPlanPrice("plus"),
        originalPrice: getOriginalPrice("plus"),
        duration: t("plus_plan_duration"),
        buttonText: getButtonText("plus"),
        features: [
          t("plus_feature_1"),
          t("plus_feature_2"),
          t("plus_feature_3"),
          t("plus_feature_4"),
          t("plus_feature_5"),
          t("plus_feature_6"),
        ],
        isSubscribed: isCurrentPlan("plus", subStatus.currentPointType, activeTab),
        isDisabled: !canInteractWithPlan("plus"),
        disabledReason: getDisabledReason("plus"),
        canUpgradeTo: canUpgradeToPlan("plus", subStatus.availableUpgrades),
        // canDowngradeTo: subStatus.availableDowngrades.includes("PLUS"),
        upgradeType: getUpgradeType("plus"),
      },
      {
        id: "pro",
        name: t("pro_plan_name"),
        tagline: t("pro_plan_tagline"),
        subTagline: t("pro_plan_subtagline"),
        price: getPlanPrice("pro"),
        originalPrice: getOriginalPrice("pro"),
        duration: t("pro_plan_duration"),
        buttonText: getButtonText("pro"),
        features: [
          t("pro_feature_1"),
          t("pro_feature_2"),
          t("pro_feature_3"),
          t("pro_feature_4"),
          t("pro_feature_5"),
          t("pro_feature_6"),
          t("pro_feature_7"),
        ],
        isSubscribed: isCurrentPlan("pro", subStatus.currentPointType, activeTab),
        isDisabled: !canInteractWithPlan("pro"),
        disabledReason: getDisabledReason("pro"),
        isPopular: true,
        canUpgradeTo: canUpgradeToPlan("pro", subStatus.availableUpgrades),
        // canDowngradeTo: subStatus.availableDowngrades.includes("PRO"),
        upgradeType: getUpgradeType("pro"),
      },
      {
        id: "max",
        name: t("max_plan_name"),
        tagline: t("max_plan_tagline"),
        subTagline: t("max_plan_subtagline"),
        price: getPlanPrice("max"),
        originalPrice: getOriginalPrice("max"),
        duration: t("max_plan_duration"),
        buttonText: getButtonText("max"),
        features: [
          t("max_feature_1"),
          t("max_feature_2"),
          t("max_feature_3"),
          t("max_feature_4"),
          t("max_feature_5"),
          t("max_feature_6"),
          t("max_feature_7"),
        ],
        isSubscribed: isCurrentPlan("max", subStatus.currentPointType, activeTab),
        isDisabled: !canInteractWithPlan("max"),
        disabledReason: getDisabledReason("max"),
        canUpgradeTo: canUpgradeToPlan("max", subStatus.availableUpgrades),
        // canDowngradeTo: subStatus.availableDowngrades.includes("MAX"),
        upgradeType: getUpgradeType("max"),
      },
      {
        id: "payg",
        name: t("payg_plan_name"),
        tagline: t("payg_plan_tagline"),
        price: t("payg_plan_price"),
        duration: t("payg_plan_duration"),
        buttonText: t("payg_plan_button_"),
        features: [
          t("payg_feature_1"),
          t("payg_feature_2"),
          t("payg_feature_3"),
          t("payg_feature_4"),
          t("payg_feature_5"),
          t("payg_feature_6"),
          t("payg_feature_7"),
        ],
        isSubscribed: false, // PAYG 不是訂閱
        isDisabled: false,
        disabledReason: !subStatus.canSubscribePayg
          ? locale === "zh"
            ? t("ongoing_purchase")
            : "Already have pending credits purchase"
          : undefined,
      },
    ];
  };

  // 🆕 修改：判斷是否可以與方案互動（包含恢復訂閱，考慮計費週期）
  const canInteractWithPlan = (planId: string): boolean => {
    // 🆕 如果訂閱已取消，禁用所有升級操作
    if (subStatus.activeSubscription?.cancelAtPeriodEnd) {
      // console.log('❌ 訂閱已取消，禁用操作:', planId);
      return false;
    }
    
    // 🆕 使用新的 Helper 判斷是否為當前方案（考慮計費週期）
    const isCurrent = isCurrentPlan(planId, subStatus.currentPointType, activeTab);
    if (isCurrent) {
      // console.log('❌ 是當前方案，不能操作:', {
      //   planId,
      //   currentPointType: subStatus.currentPointType,
      //   activeTab
      // });
      return false; // 當前方案不能操作
    }
    
    // 如果沒有訂閱，可以新訂閱
    if (!subStatus.hasActiveSubscription) {
      // console.log('✅ 沒有訂閱，可以新訂閱:', planId);
      return true;
    }
    
    // 🆕 如果有訂閱，檢查是否可以升級（考慮計費週期）
    const canUpgrade = canUpgradeToPlan(planId, subStatus.availableUpgrades);
    // console.log('🔍 canInteractWithPlan 結果:', {
    //   planId,
    //   hasActiveSubscription: subStatus.hasActiveSubscription,
    //   canUpgrade,
    //   result: canUpgrade
    // });
    return canUpgrade;
  };

  // 🆕 修改：獲取按鈕文字（包含恢復訂閱，考慮計費週期）
  const getButtonText = (planId: string): string => {
    const locale = getCurrentLocale();
    
    // 🆕 使用新的 Helper 判斷是否為當前方案（考慮計費週期）
    if (isCurrentPlan(planId, subStatus.currentPointType, activeTab)) {
      return t("current_plan");
    }
    
    // 🆕 如果可以升級（考慮計費週期）
    if (canUpgradeToPlan(planId, subStatus.availableUpgrades)) {
      const planName = planId.charAt(0).toUpperCase() + planId.slice(1);
      const Plus = t('plus_plan_display')
      const Pro = t('pro_plan_display')
      const Max = t('max_plan_display')      
      
      // 根據方案ID返回對應的中文或英文名稱
      let displayName;
      if (planId === 'plus') {
        displayName = Plus;
      } else if (planId === 'pro') {
        displayName = Pro;
      } else if (planId === 'max') {
        displayName = Max;
      } else {
        displayName = planName;
      }
      
      return t('upgrade_to', { plan: displayName });
    }
    
    // 如果可以降級
    // if (subStatus.availableDowngrades.includes(upperPlanId)) {
    //   const planName = planId.charAt(0).toUpperCase() + planId.slice(1);
    //   return locale === "zh" ? `降級至 ${planName}` : `Downgrade to ${planName}`;
    // }
    
    // 🔧 修正：使用類型安全的方式
    const defaultTexts: Record<string, { zh: string; en: string }> = {
      plus: { zh: t("plus_plan_button_"), en: t("plus_plan_button_") },
      pro: { zh: t("pro_plan_button_"), en: t("pro_plan_button_") }, 
      max: { zh: t("max_plan_button_"), en: t("max_plan_button_") },
      payg: { zh: t("payg_plan_button_"), en: t("payg_plan_button_") }
    };
    
    const textConfig = defaultTexts[planId];
    if (textConfig) {
      return locale === "zh" ? textConfig.zh : textConfig.en;
    }
    
    // 備用方案
    const planName = planId.charAt(0).toUpperCase() + planId.slice(1);
    return t('choose', { plan: planName });
  };

  // 🆕 獲取禁用原因（考慮計費週期）
  const getDisabledReason = (planId: string): string | undefined => {
    // 如果訂閱已取消，提供明確的禁用原因
    if (subStatus.activeSubscription?.cancelAtPeriodEnd) {
      return t("subscription_cancelled");
    }
    
    // 🆕 使用新的 Helper 判斷是否為當前方案（考慮計費週期）
    if (isCurrentPlan(planId, subStatus.currentPointType, activeTab)) {
      return t("current_plan");
    }
    
    if (!canInteractWithPlan(planId)) {
      return t("cannot_change_plan");
    }
    
    return undefined;
  };

  // 🆕 獲取升級類型（考慮計費週期）
  const getUpgradeType = (planId: string): 'upgrade' | 'downgrade' | null => {
    // 🆕 使用新的 Helper 檢查是否可以升級（考慮計費週期）
    if (canUpgradeToPlan(planId, subStatus.availableUpgrades)) {
      return 'upgrade';
    }
    
    // if (subStatus.availableDowngrades.includes(upperPlanId)) {
    //   return 'downgrade';
    // }
    
    return null;
  };
  

  const plans = getPlans();


  const fetchUserStatus = useCallback(async () => {
    const response = await authenticatedRequest(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/user-status`
    );

    if (!response) {
      throw new Error("Failed to fetch user status");
    }

    return response.json();
  }, [authenticatedRequest]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
      setIsLoadingStatus(true);

      fetchUserStatus()
        .then((res) => {
          // console.log('🔍 User status from backend:', res);
          
          // 🆕 添加詳細的調試信息
          // console.log('🔍 PaymentModelDialog processing data:', {
          //   currentPointType: res.currentPointType,
          //   hasActiveSubscription: res.hasActiveSubscription,
          //   activeSubscription: res.activeSubscription,
          //   activeSubscriptionCurrentPeriodEnd: res.activeSubscription?.currentPeriodEnd,
          //   activeSubscriptionCurrentPeriodEndType: typeof res.activeSubscription?.currentPeriodEnd
          // });
          setSubStatus({
            canSubscribePayg: res.canSubscribePayg,
            canSubscribePlus: res.canSubscribePlus,
            canSubscribePro: res.canSubscribePro || true,
            canSubscribeMax: res.canSubscribeMax || true,
            // 🆕 新增的狀態
            hasActiveSubscription: res.hasActiveSubscription || false,
            currentPointType: res.currentPointType || "FREE",
            currentPeriodEnd: res.currentPeriodEnd || res.activeSubscription?.currentPeriodEnd, // 🆕 添加 currentPeriodEnd
            canUpgrade: res.canUpgrade || false,
            availableUpgrades: res.availableUpgrades || [],
            activeSubscription: res.activeSubscription,
          });
        })
        .catch((error) => {
          console.error("Failed to get user status:", error);
          setSubStatus({
            canSubscribePayg: true,
            canSubscribePlus: true,
            canSubscribePro: true,
            canSubscribeMax: true,
            hasActiveSubscription: false,
            currentPointType: "FREE",
            currentPeriodEnd: undefined, // 🆕 添加 currentPeriodEnd
            canUpgrade: false,
            availableUpgrades: [],
          });
        })
        .finally(() => {
          setIsLoadingStatus(false);
        });
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen, fetchUserStatus]);

  const handleClose = () => {
    onClose();
    if (onCloseCallback) {
      onCloseCallback();
    }
  };

  // 🆕 處理升級確認對話框
  const handleUpgradeConfirm = async () => {
    if (!pendingUpgradePlan) return;
    
    setShowUpgradeConfirmDialog(false);
    await handleUpgradeDowngrade(pendingUpgradePlan.planId, pendingUpgradePlan.upgradeType);
    setPendingUpgradePlan(null);
  };

  // 🆕 處理升級確認對話框取消
  const handleUpgradeCancel = () => {
    setShowUpgradeConfirmDialog(false);
    setPendingUpgradePlan(null);
  };

  // 處理條款同意後的邏輯
  const handleAgreeTerms = () => {
    localStorage.setItem("termsAgreed", "true");
    setShowCopyrightDialog(false);

    if (pendingLogin && setIsDialogOpen) {
      handleClose();
      setTimeout(() => {
        setIsDialogOpen(true);
      }, 100);
      setPendingLogin(false);
    }
  };

  // 處理免費方案點擊
  const handleStandardPlanClick = () => {
    if (onStandardPlanClick) {
      onStandardPlanClick();
      return;
    }

    if (localStorage.getItem("termsAgreed") === "true") {
      if (setIsDialogOpen) {
        handleClose();
        setTimeout(() => {
          setIsDialogOpen(true);
        }, 100);
      }
    } else {
      setShowCopyrightDialog(true);
      setPendingLogin(true);
    }
  };

  // 🔧 修改：處理升級/降級操作
  const handleUpgradeDowngrade = async (planId: string, upgradeType: 'upgrade' | 'downgrade') => {

    
    try {
      const endpoint = upgradeType === 'upgrade' ? 'upgrade-subscription' : 'downgrade-subscription';
      
      // 🆕 請求前狀態驗證（考慮計費週期）
      const billingCycle = activeTab === 'yearly' ? 'yearly' : 'monthly';
      const targetTransactionType = buildTransactionType(planId, billingCycle);
      const canProceed = upgradeType === 'upgrade' 
        ? canUpgradeToPlan(planId, subStatus.availableUpgrades)
        : false; // 降級功能暫時不支援
        // : subStatus.availableDowngrades.includes(upperPlanId);
        
      if (!canProceed) {
        const message = t('cannot_upgrade_to', { plan: planId.toUpperCase() });
        showToast(message);
        return;
      }
      
      const requestData = {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          targetPlan: targetTransactionType, // 🆕 使用完整的 transactionType（包含計費週期）
        }),
      };
      
      console.log('🚀 Upgrade request details:', {
        planId: planId.toUpperCase(),
        currentPointType: subStatus.currentPointType,
        availableUpgrades: subStatus.availableUpgrades,
        upgradeType: upgradeType,
        endpoint: `${process.env.NEXT_PUBLIC_SERVER_URL}/${endpoint}`,
        requestMethod: requestData.method,
        requestBody: requestData.body
      });
      
      const response = await authenticatedRequest(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/${endpoint}`,
        requestData
      );

      if (!response) {
        throw new Error(`Failed to ${upgradeType} subscription`);
      }

      // 🆕 添加錯誤狀態檢查
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('Backend error details:', errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success) {
        let message = "";
        if (upgradeType === 'upgrade') {
          message = t('upgrade_success', { plan: planId.toUpperCase() });
        } else {
          message = t('downgrade_scheduled', { plan: planId.toUpperCase() });
        }
        
        showToast(message);
        
        // 重新獲取用戶狀態
        fetchUserStatus().then((res) => {
          setSubStatus({
            canSubscribePayg: res.canSubscribePayg,
            canSubscribePlus: res.canSubscribePlus,
            canSubscribePro: res.canSubscribePro || true,
            canSubscribeMax: res.canSubscribeMax || true,
            hasActiveSubscription: res.hasActiveSubscription || false,
            currentPointType: res.currentPointType || "FREE",
            currentPeriodEnd: res.currentPeriodEnd || res.activeSubscription?.currentPeriodEnd, // 🆕 添加 currentPeriodEnd
            canUpgrade: res.canUpgrade || false,
            // canDowngrade: res.canDowngrade || false,
            availableUpgrades: res.availableUpgrades || [],
            // availableDowngrades: res.availableDowngrades || [],
            activeSubscription: res.activeSubscription,
          });
        });

        handleClose();
      } else {
        const errorMessage = upgradeType === 'upgrade' 
          ? t('upgrade_failed', { error: result.error })
          : t('downgrade_failed', { error: result.error });
        showToast(errorMessage);
      }
    } catch (error) {
      console.error(`${upgradeType} failed:`, error);
      
      // 🆕 顯示具體錯誤訊息
      let errorMessage = "";
      if (error instanceof Error && error.message.includes('HTTP')) {
        // 如果是 HTTP 錯誤，顯示具體訊息
        errorMessage = upgradeType === 'upgrade' 
          ? t('upgrade_failed_message', { message: error.message })
          : t('downgrade_failed_message', { message: error.message });
      } else {
        // 一般錯誤訊息
        errorMessage = upgradeType === 'upgrade' 
          ? t('upgrade_failed_generic')
          : t('downgrade_failed_generic');
      }
      showToast(errorMessage);
    }
  };

  const fetchOrderPreview = async (transactionType: string, locale: string) => {
    const response = await authenticatedRequest(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/order-preview?transactionType=${transactionType}&locale=${locale}`
    );

    if (!response) {
      throw new Error("Failed to fetch order preview - No response");
    }

    // 🆕 添加詳細的錯誤處理
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('❌ Backend order preview error:', errorData);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (parseError) {
        console.error('❌ Failed to parse order preview error response:', parseError);
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    // console.log('✅ Order preview fetched:', result);
    return result;
  };

  // 🔧 修改：處理方案選擇（包含升級/降級和恢復訂閱）
  const handleSelectPlan = async (planId: "standard" | "plus" | "pro" | "max" | "payg") => {
    // console.log('🎯 handleSelectPlan 被調用:', {
    //   planId,
    //   skipUpgradeConfirm,
    //   activeTab,
    //   plansCount: plans.length
    // });

    if (planId === "standard") {
      handleStandardPlanClick();
      return;
    }
  
    // 找到對應的方案
    const selectedPlan = plans.find((p) => p.id === planId);
    // console.log('🔍 找到的方案:', {
    //   planId,
    //   selectedPlan: selectedPlan ? {
    //     id: selectedPlan.id,
    //     isDisabled: selectedPlan.isDisabled,
    //     upgradeType: selectedPlan.upgradeType
    //   } : null,
    //   skipUpgradeConfirm
    // });

    if (!selectedPlan) {
      console.error('❌ 找不到方案:', planId);
      return;
    }
  
    // 檢查是否被禁用
    if (selectedPlan.isDisabled) {
      const message = selectedPlan.disabledReason ||
        t("temporarily_unavailable");
      showToast(message);
      return;
    }
  
    // �� 修改：恢復訂閱直接處理，不顯示付款確認
    const upperPlanId = planId.toUpperCase();
    if (subStatus.currentPointType === upperPlanId && 
        subStatus.activeSubscription?.cancelAtPeriodEnd) {
      
      // 直接恢復訂閱，不需要付款確認
      // await handleRestoreSubscription(planId);
      // return;
    }
  
    // 🆕 如果是升級或降級操作（且不是從 UpgradePopupAd 直接來的）
    if (selectedPlan.upgradeType && !skipUpgradeConfirm) {
      // console.log('📋 顯示升級確認對話框:', {
      //   planId,
      //   upgradeType: selectedPlan.upgradeType,
      //   skipUpgradeConfirm
      // });
      // 🆕 顯示升級確認對話框
      let planName = "";
      
      // 根據方案ID獲取中文名稱
      if (planId === 'plus') {
        planName = t('plus_plan_display');
      } else if (planId === 'pro') {
        planName = t('pro_plan_display');
      } else if (planId === 'max') {
        planName = t('max_plan_display');
      } else {
        planName = planId.toUpperCase();
      }
      
      setPendingUpgradePlan({
        planId,
        planName,
        upgradeType: selectedPlan.upgradeType
      });
      setShowUpgradeConfirmDialog(true);
      return;
    }
    
    // 🆕 如果從 UpgradePopupAd 來且是升級操作，直接進入付款流程（跳過升級確認）
    // 這樣用戶在 UpgradePopupAd 選擇方案後，會直接看到付款確認對話框
    // console.log('💳 進入付款流程:', {
    //   planId,
    //   activeTab,
    //   skipUpgradeConfirm,
    //   upgradeType: selectedPlan.upgradeType
    // });
  
    // 🆕 原有的新訂閱邏輯 - 根據 activeTab 決定 transactionType
    setIsLoadingPreview(true);
    try {
      const locale = getCurrentLocale();
      // 🆕 根據當前標籤（年訂閱/月訂閱）和方案ID生成 transactionType
      const billingCycle = activeTab === 'yearly' ? 'yearly' : 'monthly';
      const transactionType = buildTransactionType(planId, billingCycle);
      const data = await fetchOrderPreview(transactionType, locale);
      
      setOrderData(data);
      setShowPaymentConfirmation(true);
    } catch (error) {
      console.error("Failed to get order preview:", error);
      const locale = getCurrentLocale();
      const message =
        locale === "zh"
          ? t("get_order_info_failed")
          : "Failed to get order information, please try again later";
      showToast(message);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 🆕 當對話框打開且有初始方案時，自動選擇方案
  useEffect(() => {
    if (isOpen && initialPlan && !isLoadingStatus && plans.length > 0) {
      // console.log('🚀 自動選擇方案:', {
      //   initialPlan,
      //   skipUpgradeConfirm,
      //   activeTab,
      //   plansLength: plans.length
      // });
      // 等待一下確保狀態已更新
      const timer = setTimeout(() => {
        // console.log('✅ 執行自動選擇方案:', initialPlan);
        handleSelectPlan(initialPlan);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialPlan, isLoadingStatus, plans.length, skipUpgradeConfirm]);
  
  // 移除恢復訂閱功能，用戶取消訂閱後只能重新訂閱

  const createCheckoutSession = async (transactionType: string) => {
    console.log('🔍 Creating checkout session:', {
      transactionType,
      path,
      url: `${process.env.NEXT_PUBLIC_SERVER_URL}/create-checkout`
    });

    try {
      // 🆕 添加超時處理
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout - 30 seconds')), 30000);
      });

      const requestPromise = authenticatedRequest(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/create-checkout`,
        {
          method: "POST",
          body: JSON.stringify({ transactionType, path }),
        }
      );

      // 競爭超時和請求
      const response = await Promise.race([requestPromise, timeoutPromise]) as Response;

      console.log('📡 Response received:', {
        status: response?.status,
        ok: response?.ok,
        statusText: response?.statusText
      });

      if (!response) {
        throw new Error("Failed to create checkout session - No response");
      }

      // 🆕 添加詳細的錯誤處理
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('❌ Backend checkout error:', errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          console.error('❌ Failed to parse checkout error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Checkout session created:', result);
      return result;
    } catch (error) {
      console.error('❌ Checkout session creation failed:', error);
      throw error;
    }
  };

  // 處理付款確認
  const handlePaymentConfirm = async () => {
    try {
      if (!orderData) {
        console.error('❌ No order data available');
        return;
      }
      
      console.log('🚀 Starting payment confirmation with order data:', orderData);
      const checkout = await createCheckoutSession(orderData.transactionType);
      
      // 🆕 檢查是否為取消退訂的回應
      if (checkout.action === 'cancelled_retirement') {
        const message = checkout.message || 
          t("subscription_restored");
        showToast(message);
        
        // 重新獲取用戶狀態
        fetchUserStatus().then((res) => {
          setSubStatus({
            canSubscribePayg: res.canSubscribePayg,
            canSubscribePlus: res.canSubscribePlus,
            canSubscribePro: res.canSubscribePro || true,
            canSubscribeMax: res.canSubscribeMax || true,
            hasActiveSubscription: res.hasActiveSubscription || false,
            currentPointType: res.currentPointType || "FREE",
            currentPeriodEnd: res.currentPeriodEnd || res.activeSubscription?.currentPeriodEnd, // 🆕 添加 currentPeriodEnd
            canUpgrade: res.canUpgrade || false,
            // canDowngrade: res.canDowngrade || false,
            availableUpgrades: res.availableUpgrades || [],
            // availableDowngrades: res.availableDowngrades || [],
            activeSubscription: res.activeSubscription,
          });
        });
        
        setShowPaymentConfirmation(false);
        setOrderData(null);
        handleClose();
        return;
      }
      
      // 正常的付款流程
      console.log('🔄 Redirecting to checkout URL:', checkout.url);
      window.location.href = checkout.url;
    } catch (error) {
      console.error("❌ Failed to create payment session:", error);
      
      // 🆕 顯示具體錯誤訊息
      const locale = getCurrentLocale();
      let message = "";
      
      if (error instanceof Error) {
        if (error.message.includes('HTTP')) {
          // HTTP 錯誤，顯示具體狀態碼和訊息
          message = locale === "zh" 
            ? `建立付款會話失敗：${error.message}` 
            : `Failed to create payment session: ${error.message}`;
        } else if (error.message.includes('No response')) {
          // 網路錯誤
          message = locale === "zh" 
            ? t("network_connection_failed") 
            : "Network connection failed, please check your internet connection";
        } else {
          // 其他錯誤
          message = locale === "zh" 
            ? `建立付款會話失敗：${error.message}` 
            : `Failed to create payment session: ${error.message}`;
        }
      } else {
        // 未知錯誤
        message = locale === "zh" 
          ? t("create_payment_session_failed") 
          : "Failed to create payment session, please try again later";
      }
      
      showToast(message);
    }
  };

  const getVisiblePlans = () => {
    if (activeTab === "yearly") {
      // 年訂閱頁面顯示：免費 + 3個付費方案 (Plus, Pro, Max)
      return [plans[0], plans[1], plans[2], plans[3]];
    } else if (activeTab === "monthly") {
      // 月訂閱頁面顯示：免費 + 3個付費方案 (Plus, Pro, Max)
      return [plans[0], plans[1], plans[2], plans[3]];
    } else {
      // 點數頁面只顯示 PAYG
      return [plans[4]];
    }
  };

  const visiblePlans = getVisiblePlans();

  if (!isVisible && !isOpen) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[10000] flex justify-center items-center overflow-hidden outline-none focus:outline-none transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm transition-opacity duration-300 ease-in-out"
          onClick={handleClose}
        ></div>

        <div
          className={`fixed inset-0 flex flex-col transition-all duration-300 ease-in-out ${
            isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-full w-full flex-col overflow-hidden bg-custom-white dark:bg-custom-white-dark">
            <div className="relative flex flex-col items-center bg-custom-gray/35 p-5 dark:bg-white/[0.03]">
              <button
                className="absolute right-4 top-4 rounded-xl p-1.5 text-gray-400 transition-colors duration-200 hover:bg-white/70 hover:text-gray-600 dark:hover:bg-white/[0.04] dark:hover:text-gray-300"
                onClick={handleClose}
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="mb-4 text-xl font-semibold text-stone-900 dark:text-white">
                {t("upgrade_your_plan")}
              </h2>
                              {/* {subStatus.currentPeriodEnd && (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {t("next_billing")}
                      {(() => {
                        const periodEnd = subStatus.currentPeriodEnd;
                        try {
                          // 檢查是否為 ISO 字符串格式
                          if (typeof periodEnd === 'string') {
                            return new Date(periodEnd).toLocaleDateString();
                          } 
                          // 檢查是否為 Unix 時間戳
                          else if (typeof periodEnd === 'number') {
                            // 如果數字小於 2000000000，假設是秒時間戳
                            if (periodEnd < 2000000000) {
                              return new Date(periodEnd * 1000).toLocaleDateString();
                            } else {
                              // 否則假設是毫秒時間戳
                              return new Date(periodEnd).toLocaleDateString();
                            }
                          }
                          return 'Invalid Date';
                        } catch (error) {
                          console.error('Date conversion error in PaymentModelDialog:', error);
                          return 'Invalid Date';
                        }
                      })()}
                    </p>
                  )} */}



              {/* 標籤切換按鈕 - 桌面版和移動版都顯示 */}
              <div className="flex rounded-2xl bg-white/75 p-1 shadow-[0_8px_20px_rgba(46,30,78,0.04)] dark:bg-white/[0.04]">
                <button
                  className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                    activeTab === "yearly"
                      ? "bg-custom-white text-stone-900 shadow-[inset_0_0_0_1px_rgba(109,91,208,0.14)] dark:bg-white/[0.08] dark:text-white"
                      : "text-stone-500 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white"
                  }`}
                  onClick={() => setActiveTab("yearly")}
                >
                  {t("yearly_subscription")}
                </button>
                <button
                  className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                    activeTab === "monthly"
                      ? "bg-custom-white text-stone-900 shadow-[inset_0_0_0_1px_rgba(109,91,208,0.14)] dark:bg-white/[0.08] dark:text-white"
                      : "text-stone-500 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white"
                  }`}
                  onClick={() => setActiveTab("monthly")}
                >
                  {t("monthly_subscription")}
                </button>
                <button
                  className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                    activeTab === "points"
                      ? "bg-custom-white text-stone-900 shadow-[inset_0_0_0_1px_rgba(109,91,208,0.14)] dark:bg-white/[0.08] dark:text-white"
                      : "text-stone-500 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white"
                  }`}
                  onClick={() => setActiveTab("points")}
                >
                  {t("points")}
                </button>
              </div>
            </div>

            <div className="payment-custom-scrollbar flex-grow overflow-y-auto p-4 md:p-6">
              {isLoadingStatus ? (
                <div className="flex items-center justify-center h-64">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-600 dark:text-gray-400">
                      {t("loading")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="max-w-6xl mx-auto">
                  {/* 桌面版布局 */}
                  <div
                    className={`hidden md:grid gap-6 pt-4 ${
                      activeTab === "yearly" || activeTab === "monthly"
                        ? "md:grid-cols-2 lg:grid-cols-4" // 4個方案使用4列
                        : "md:grid-cols-1 max-w-md mx-auto" // PAYG 單獨一列
                    }`}
                  >
                    {visiblePlans.map((plan) => (
                      <div key={plan.id} className="w-full flex justify-center relative">
                        {/* 🆕 將熱門標籤移到外層容器 */}
                        {plan.isPopular && (
                          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                            <span className="rounded-full bg-[#6d5bd0] px-3 py-1 text-xs font-medium text-white shadow-[0_8px_18px_rgba(109,91,208,0.22)]">
                              {t("popular")}
                            </span>
                          </div>
                        )}
                        <PlanCard
                          plan={plan}
                          onSelect={handleSelectPlan}
                          isLoadingPreview={isLoadingPreview}
                        />
                      </div>
                    ))}
                  </div>

                  {/* 移動版布局 */}
                  <div className="grid grid-cols-1 gap-6 pt-4 md:hidden">
                    {visiblePlans.map((plan) => (
                      <div key={plan.id} className="w-full relative">
                        {/* 🆕 移動版熱門標籤也移到外層 */}
                        {plan.isPopular && (
                          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                            <span className="rounded-full bg-[#6d5bd0] px-3 py-1 text-xs font-medium text-white shadow-[0_8px_18px_rgba(109,91,208,0.22)]">
                              {t("popular")}
                            </span>
                          </div>
                        )}
                        <PlanCard
                          plan={plan}
                          onSelect={handleSelectPlan}
                          isLoadingPreview={isLoadingPreview}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {showCopyrightDialog && (
          <CopyrightNoticeDialog
            isOpen={showCopyrightDialog}
            onClose={() => setShowCopyrightDialog(false)}
            onAgree={handleAgreeTerms}
          />
        )}
      </div>

      {/* 🎯 使用簡化的付款確認對話框 */}
      {showPaymentConfirmation && orderData && (
        <PaymentConfirmationDialog
          isOpen={showPaymentConfirmation}
          onClose={() => {
            setShowPaymentConfirmation(false);
            setOrderData(null);
          }}
          onConfirm={handlePaymentConfirm}
          orderData={orderData} // 直接使用後端返回的資料，不需要複雜處理
          userPoint={userPoint}
        />
      )}

      {/* 🆕 升級確認對話框 */}
      {showUpgradeConfirmDialog && pendingUpgradePlan && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] transition-opacity duration-300 ease-out"
            onClick={handleUpgradeCancel}
            aria-hidden="true"
          />
          
          {/* Dialog container */}
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
            <div 
              role="dialog" 
              aria-modal="true"
              aria-labelledby="upgrade-dialog-title"
              aria-describedby="upgrade-dialog-description"
              className="relative bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700 shadow-xl transform transition-all duration-300 ease-out scale-100"
            >
              {/* Close button */}
              <button
                type="button"
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={handleUpgradeCancel}
                aria-label={t('close_dialog')}
              >
                <X className="w-5 h-5" />
              </button>

              {/* Dialog content */}
              <div className="mb-6">
                <h3 
                  id="upgrade-dialog-title"
                  className="text-lg font-bold text-gray-800 dark:text-white mb-3"
                >
                  {t('confirm_plan_change')}
                </h3>
                <p 
                  id="upgrade-dialog-description"
                  className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed"
                >
                  {t('confirm_change_question', { 
                    action: pendingUpgradePlan.upgradeType === 'upgrade' ? t('upgrade_action') : t('downgrade_action'),
                    plan: pendingUpgradePlan.planName 
                  })}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  {pendingUpgradePlan.upgradeType === 'upgrade' 
                    ? t('upgrade_immediate')
                    : t('downgrade_next_cycle')
                  }
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleUpgradeCancel}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleUpgradeConfirm}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {t('confirm_change')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        .payment-custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #333 transparent;
        }

        .payment-custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .payment-custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .payment-custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 9999px;
        }

        .payment-custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #444;
        }

        .dark .payment-custom-scrollbar {
          scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
        }

        .dark .payment-custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.28);
        }

        .dark .payment-custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </>
  );
};

interface PlanProps {
  plan: Plan;
  onSelect: (planId: "standard" | "plus" | "pro" | "max" | "payg") => void;
  isLoadingPreview: boolean;
}

const PlanCard: React.FC<PlanProps> = ({
  plan,
  onSelect,
  isLoadingPreview,
}) => {
  const t = useTranslations("payment");
  // 根據方案狀態決定按鈕樣式
  const getButtonStyle = () => {
    if (plan.isDisabled && !plan.buttonText.includes(t("restore")) && !plan.buttonText.includes("Restore")) {
      return "bg-stone-300 dark:bg-gray-600 text-white/80 dark:text-gray-400 cursor-not-allowed";
    }

    if (plan.id === "standard") {
      return "bg-stone-900 hover:bg-stone-800 text-white cursor-pointer dark:bg-white/10 dark:hover:bg-white/15";
    }

    // 升級按鈕樣式
    if (plan.upgradeType === 'upgrade') {
      return "bg-[#6d5bd0] hover:bg-[#5f4ec2] text-white cursor-pointer";
    }

    // Pro 方案使用特殊顏色
    if (plan.id === "pro") {
      return "bg-[#6d5bd0] hover:bg-[#5f4ec2] text-white cursor-pointer";
    }

    // Max 方案使用金色漸變
    if (plan.id === "max") {
      return "bg-[#1f1b2b] hover:bg-[#17141f] text-white cursor-pointer dark:bg-[#2c253a] dark:hover:bg-[#352c46]";
    }

    return "bg-[#6d5bd0] hover:bg-[#5f4ec2] text-white cursor-pointer";
  };

  const shouldShowLoading =
    isLoadingPreview && plan.id !== "standard" && !plan.isDisabled;

  return (
    <div className={`relative flex h-full flex-col overflow-hidden rounded-2xl bg-custom-white text-gray-800 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all duration-200 hover:shadow-[0_14px_30px_rgba(15,23,42,0.07)] dark:bg-[#1b1723] dark:text-white ${
      plan.isPopular 
        ? "ring-2 ring-[#6d5bd0]/12 dark:ring-[#8f7ef0]/18" 
        : plan.isSubscribed
        ? "ring-2 ring-green-100 dark:ring-green-900/20"
        : ""
    }`}>
      {/* 🆕 熱門標籤已移至外層容器 */}

      {/* 當前方案標籤 */}
      {plan.isSubscribed && (
        <div className="absolute top-0 right-4 z-20">
          <span className="rounded-b-lg bg-green-600 px-3 py-1 text-xs font-medium text-white shadow-[0_8px_18px_rgba(34,197,94,0.18)]">
            {t("current_plan")}
          </span>
        </div>
      )}

      <div className="flex h-[320px] flex-col justify-between p-6">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-medium">{plan.name}</h3>
            {/* 🆕 升級/降級圖標 */}
            {plan.upgradeType === 'upgrade' && (
              <ArrowUp className="w-5 h-5 text-[#6d5bd0]" />
            )}
          </div>

          <p className="text-sm text-stone-600 dark:text-white/65">
            {plan.tagline}
          </p>
          {plan.subTagline && (
            <p className="mt-2 text-xs text-stone-500 dark:text-white/45">
              {plan.subTagline}
            </p>
          )}

          <div className="mt-4">
            {plan.originalPrice ? (
               // 有折扣時的顯示 - 重要價格在上方
               <div className="space-y-2">
                 {/* 最重要的價格 - 折扣價在上方 */}
                 <p className={`text-2xl font-bold ${
                   plan.id === "max" ? "text-[#1f1b2b] dark:text-[#f2d38b]" :
                   plan.id === "pro" ? "text-[#6d5bd0] dark:text-[#9d8cf8]" :
                   ""
                 }`}>
                   {plan.price}
                 </p>
                 
                 {/* 原價和折扣標籤在同一行 */}
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-gray-400 line-through">
                     {plan.originalPrice}
                   </span>
                   <span className="rounded-full bg-[#f5ede0] px-2 py-0.5 text-xs font-bold text-[#9a6b17] shadow-sm dark:bg-[#3a2b13] dark:text-[#f3c874]">
                     {t("discount_off")}
                   </span>
                 </div>
               </div>
            ) : (
              // 無折扣時的顯示
              <p className={`text-2xl font-bold ${
                plan.id === "max" ? "text-[#1f1b2b] dark:text-[#f2d38b]" :
                plan.id === "pro" ? "text-[#6d5bd0] dark:text-[#9d8cf8]" :
                ""
              }`}>
                {plan.price}
              </p>
            )}
            <p className="mt-1 text-sm text-stone-600 dark:text-white/65">
              {plan.duration}
            </p>
            {/* 🆕 升級/降級說明 */}
            {plan.upgradeType && (
              <p className="mt-1 text-xs text-stone-500 dark:text-white/45">
                {plan.upgradeType === 'upgrade' 
                  ? t("effective_immediately")
                  : t("next_billing_cycle")
                }
              </p>
            )}
            {!plan.upgradeType && (
              <p className="mt-1 text-xs text-stone-500 dark:text-white/45">
                {window.location.pathname.startsWith("/en") 
                  ? "Tax included" 
                  : t("tax_included_price")}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          {/* 顯示禁用原因 */}
          {plan.disabledReason && !plan.buttonText.includes(t("restore")) && !plan.buttonText.includes("Restore") && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">
              {/* {plan.disabledReason} */}
            </p>
          )}

          <button
            onClick={() => onSelect(plan.id)}
            disabled={isLoadingPreview || (plan.isDisabled && !plan.buttonText.includes(t("restore")) && !plan.buttonText.includes("Restore"))}
            className={`flex w-full items-center justify-center rounded-xl px-4 py-2.5 font-medium transition-all duration-200 disabled:opacity-50 ${getButtonStyle()}`}
          >
            {shouldShowLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                {plan.upgradeType === 'upgrade' && <ArrowUp className="w-4 h-4 mr-2" />}
                {plan.upgradeType === 'downgrade' && <ArrowDown className="w-4 h-4 mr-2" />}
                {plan.buttonText}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-grow p-6">
        <ul className="space-y-3">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <div className="flex-shrink-0 w-5 h-5 mr-3 mt-0.5">
                <Check
                  className={`w-5 h-5 ${
                    plan.isSubscribed
                      ? "text-green-600 dark:text-green-400"
                      : plan.id === "max"
                      ? "text-[#a97818] dark:text-[#f2d38b]"
                      : plan.id === "pro"
                      ? "text-[#6d5bd0] dark:text-[#9d8cf8]"
                      : "text-[#6d5bd0] dark:text-[#9d8cf8]"
                  }`}
                />
              </div>
              <span className="text-sm leading-relaxed">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PaymentModelDialog;
