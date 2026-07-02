import React, { useState, useEffect } from "react";
import { Receipt, AlertCircle, CreditCard } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/app/context/AuthContext";
import { OrderData } from "./OrderInterfaces";
import OrderCard from "./OrderCard";
import { showToast } from "../CustomToast";
import ConfirmDialog from "../ConfirmDialog";
import { useConfirmDialog } from "@/app/hooks/useConfirmDialog";

// 移除 pendingTransactions 介面定義，不再需要降級功能

// 🆕 新增訂閱狀態介面
interface ActiveSubscription {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | string;
  status?: string;
  planType?: string;
  orderReference?: string;
  subscriptionId?: string;
}

const OrderHistoryView: React.FC = () => {
  const locale = useLocale();
  const t = useTranslations("settings");
  const { authenticatedRequest } = useAuth();
  const { dialogState, showConfirmDialog, closeDialog } = useConfirmDialog();

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);
  const [isLoadingCancel, setIsLoadingCancel] = useState(false);
  
  // 移除恢復訂閱的 loading 狀態
  
  const [subStatus, setSubStatus] = useState<{
    canSubscribePayg: boolean;
    canSubscribePlus: boolean;
    canSubscribePro: boolean;
    canSubscribeMax: boolean;
    hasActiveSubscription: boolean;
    currentPointType: string;
    currentPeriodEnd?: string | number;
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
    currentPeriodEnd: undefined,
    canUpgrade: false,
    availableUpgrades: [],
  });

  // 移除降級相關功能，不再需要檢查待處理交易

  // 🆕 安全的計劃類型顯示函數
  const getSafePlanType = () => {
    const planType = subStatus.currentPointType;
    console.log('🔍 當前計劃類型:', planType);
                     
    if (!planType || planType === "FREE") {
      return null;
    }
    
    // 根據語言返回對應的方案名稱
    switch (planType) {
      case "PLUS": return t("order_history.plus_plan");
      case "PRO": return t("order_history.pro_plan");
      case "MAX": return t("order_history.max_plan");
      case "PAYG": return t("order_history.payg_plan");
      default: return planType;
    }
  };

  // 🆕 修正：安全的下次續費日期顯示函數
  const getSafeNextBillingDate = () => {
    const periodEnd = subStatus.activeSubscription?.currentPeriodEnd || subStatus.currentPeriodEnd;
    
    console.log('🔍 獲取續費日期:', {
      activeSubscriptionEnd: subStatus.activeSubscription?.currentPeriodEnd,
      subStatusEnd: subStatus.currentPeriodEnd,
      finalPeriodEnd: periodEnd
    });
                     
    if (!periodEnd) {
      console.log('❌ 沒有有效的續費日期');
      return t("order_history.unavailable");
    }
    
    try {
      let date;
      
      if (typeof periodEnd === 'string') {
        date = new Date(periodEnd);
      } 
      else if (typeof periodEnd === 'number') {
        if (periodEnd < 2000000000) {
          date = new Date(periodEnd * 1000);
        } else {
          date = new Date(periodEnd);
        }
      } else {
        throw new Error('Invalid date format');
      }
      
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      
      const formattedDate = date.toLocaleDateString();
      console.log('✅ 續費日期格式化成功:', formattedDate);
      return formattedDate;
    } catch (error) {
      console.error('❌ 日期轉換錯誤:', error, 'Original value:', periodEnd);
      return t("order_history.invalid_date");
    }
  };

  // 🆕 判斷是否應該顯示訂閱區塊
  const shouldShowSubscriptionBlock = () => {
    const planType = getSafePlanType();
    const hasValidPeriodEnd = subStatus.activeSubscription?.currentPeriodEnd || subStatus.currentPeriodEnd;
    
    console.log('🔍 判斷是否顯示訂閱區塊:', {
      planType,
      hasValidPeriodEnd,
      shouldShow: planType && planType !== "FREE" && hasValidPeriodEnd
    });
    
    if (!hasValidPeriodEnd) {
      console.log('❌ 沒有有效的續費日期，不顯示訂閱區塊');
      return false;
    }
    
    return planType && planType !== "FREE";
  };

  // 🆕 刷新訂閱狀態的函數（提取出來復用）
  const refreshSubscriptionStatus = async () => {
    try {
      console.log('🔄 開始刷新訂閱狀態...');
      const statusResponse = await authenticatedRequest(
        `/api/billing/user-status`
      );

      if (statusResponse && statusResponse.ok) {
        const res = await statusResponse.json();
        console.log('🔍 刷新後的完整用戶狀態:', res);
        
        // 🔥 重要：完整更新所有狀態
        const newSubStatus = {
          canSubscribePayg: res.canSubscribePayg ?? true,
          canSubscribePlus: res.canSubscribePlus ?? !res.hasActiveSubscription,
          canSubscribePro: res.canSubscribePro ?? !res.hasActiveSubscription,
          canSubscribeMax: res.canSubscribeMax ?? !res.hasActiveSubscription,
          hasActiveSubscription: res.hasActiveSubscription ?? false,
          currentPointType: res.currentPointType ?? "FREE",
          currentPeriodEnd: res.currentPeriodEnd || res.activeSubscription?.currentPeriodEnd,
          canUpgrade: res.canUpgrade ?? false,
          canDowngrade: res.canDowngrade ?? false,
          availableUpgrades: res.availableUpgrades ?? [],
          availableDowngrades: res.availableDowngrades ?? [],
          activeSubscription: res.activeSubscription ?? null,
          pendingTransactions: res.pendingTransactions ?? [],
        };
        
        console.log('🔍 設置新的 subStatus:', newSubStatus);
        setSubStatus(newSubStatus);
        
        // 🔥 重要：同步更新 activeSubscription 狀態
        if (res.activeSubscription) {
          console.log('🔍 更新 activeSubscription:', res.activeSubscription);
          setActiveSubscription({
            cancelAtPeriodEnd: res.activeSubscription.cancelAtPeriodEnd ?? false,
            currentPeriodEnd: res.activeSubscription.currentPeriodEnd,
            status: "active",
            planType: res.currentPointType,
            orderReference: res.activeSubscription.orderReference,
            subscriptionId: res.activeSubscription.subscriptionId,
          });
        } else if (res.currentPointType && res.currentPointType !== "FREE") {
          // 如果沒有 activeSubscription 但有訂閱類型，創建一個基本的
          console.log('🔍 創建基本的 activeSubscription');
          const subscription: ActiveSubscription = {
            cancelAtPeriodEnd: false,
            currentPeriodEnd: res.currentPeriodEnd || 0,
            status: "active",
            planType: res.currentPointType,
          };
          setActiveSubscription(subscription);
        } else {
          console.log('🔍 清除 activeSubscription');
          setActiveSubscription(null);
        }
        
        // 🔥 重要：檢查刷新後的狀態
        console.log('✅ 訂閱狀態刷新完成，最終狀態檢查:', {
          hasActiveSubscription: res.hasActiveSubscription,
          currentPointType: res.currentPointType,
          pendingTransactionsCount: (res.pendingTransactions || []).length,
          cancelAtPeriodEnd: res.activeSubscription?.cancelAtPeriodEnd,
          pendingDowngrades: (res.pendingTransactions || []).filter((t: {recordType:string}) => t.recordType === 'DOWNGRADE').length
        });
      } else {
        console.error('❌ /user-status API 失敗:', statusResponse?.status, statusResponse?.statusText);
        // 嘗試備用方案
        await fallbackRefreshSubscriptionStatus();
      }
    } catch (err) {
      console.error("❌ 刷新訂閱狀態失敗:", err);
      // 嘗試備用方案
      await fallbackRefreshSubscriptionStatus();
    }
  };

  // 🆕 備用刷新方案
  const fallbackRefreshSubscriptionStatus = async () => {
    try {
      console.log('🔄 執行備用刷新方案...');
      const pointResponse = await authenticatedRequest(
        `/api/user/point`
      );

      if (pointResponse && pointResponse.ok) {
        const pointData = await pointResponse.json();
        console.log('🔍 從 /user/point 獲取的備用數據:', pointData);
        
        if (pointData && pointData.pointType && pointData.pointType !== "FREE") {
          const subscription: ActiveSubscription = {
            cancelAtPeriodEnd: false,
            currentPeriodEnd: pointData.expireAt ? new Date(pointData.expireAt).getTime() / 1000 : 0,
            status: "active",
            planType: pointData.pointType,
          };
          setActiveSubscription(subscription);
          
          setSubStatus(prev => ({
            ...prev,
            currentPointType: pointData.pointType,
            hasActiveSubscription: true,
            currentPeriodEnd: pointData.expireAt ? new Date(pointData.expireAt).getTime() / 1000 : undefined,
            pendingTransactions: [], // 清空 pending transactions，因為恢復成功了
          }));
          
          console.log('✅ 備用刷新方案完成');
        } else {
          setActiveSubscription(null);
          setSubStatus(prev => ({
            ...prev,
            currentPointType: "FREE",
            hasActiveSubscription: false,
            pendingTransactions: [],
          }));
        }
      }
    } catch (error) {
      console.error("❌ 備用刷新方案也失敗:", error);
    }
  };

  // 移除 refreshOrderHistory 函數，不再需要

  // 🆕 新增恢復訂閱處理函數
  // 移除恢復訂閱功能，用戶取消訂閱後只能重新訂閱

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authenticatedRequest(
          `/api/billing/user-orders`
        );

        if (!response) {
          throw new Error("Failed to fetch orders");
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success) {
          setOrders(data.orders || []);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        console.error("Error fetching orders:", err);
        setError(t("order_history.failed_to_load"));
      } finally {
        setIsLoading(false);
      }
    };

    const fetchSubscriptionStatus = async () => {
      try {
        const statusResponse = await authenticatedRequest(
          `/api/billing/user-status`
        );

        if (statusResponse && statusResponse.ok) {
          const res = await statusResponse.json();
          console.log('🔍 從後端獲取的完整用戶狀態:', res);
          
          console.log('🔍 處理用戶狀態數據:', {
            currentPointType: res.currentPointType,
            hasActiveSubscription: res.hasActiveSubscription,
            activeSubscription: res.activeSubscription,
            pendingTransactions: res.pendingTransactions,
            pendingTransactionsLength: res.pendingTransactions?.length || 0
          });
          
          setSubStatus({
            canSubscribePayg: res.canSubscribePayg,
            canSubscribePlus: res.canSubscribePlus,
            canSubscribePro: res.canSubscribePro || true,
            canSubscribeMax: res.canSubscribeMax || true,
            hasActiveSubscription: res.hasActiveSubscription || false,
            currentPointType: res.currentPointType || "FREE",
            currentPeriodEnd: res.currentPeriodEnd || res.activeSubscription?.currentPeriodEnd,
            canUpgrade: res.canUpgrade || false,
            availableUpgrades: res.availableUpgrades || [],
            activeSubscription: res.activeSubscription,
          });
          
          if (res.activeSubscription) {
            setActiveSubscription(res.activeSubscription);
          } else if (res.currentPointType && res.currentPointType !== "FREE") {
            const subscription: ActiveSubscription = {
              cancelAtPeriodEnd: false,
              currentPeriodEnd: res.currentPeriodEnd || 0,
              status: "active",
              planType: res.currentPointType,
            };
            setActiveSubscription(subscription);
          } else {
            setActiveSubscription(null);
          }
        } else {
          console.log('⚠️ /user-status 失敗，嘗試回退到 /user/point');
          const pointResponse = await authenticatedRequest(
            `/api/user/point`
          );

          if (pointResponse && pointResponse.ok) {
            const pointData = await pointResponse.json();
            console.log('🔍 從 /user/point 獲取的數據:', pointData);
            
            if (pointData && pointData.pointType && pointData.pointType !== "FREE") {
              const subscription: ActiveSubscription = {
                cancelAtPeriodEnd: false,
                currentPeriodEnd: pointData.expireAt ? new Date(pointData.expireAt).getTime() / 1000 : 0,
                status: "active",
                planType: pointData.pointType,
              };
              setActiveSubscription(subscription);
              
              setSubStatus(prev => ({
                ...prev,
                currentPointType: pointData.pointType,
                hasActiveSubscription: true,
                currentPeriodEnd: pointData.expireAt ? new Date(pointData.expireAt).getTime() / 1000 : undefined,
              }));
            } else {
              setActiveSubscription(null);
            }
          }
        }
      } catch (err) {
        console.error("❌ 獲取訂閱狀態失敗:", err);
      }
    };

    fetchOrders();
    fetchSubscriptionStatus();
  }, [authenticatedRequest, locale, t]);

  const handleCancelSubscription = async () => {
    showConfirmDialog(
      {
        title: t("order_history.cancel_subscription"),
        message: t("order_history.cancel_subscription_message"),
        variant: 'warning',
        confirmText: t("order_history.cancel"),
        cancelText: t("order_history.keep_subscription"),
      },
      async () => {
        await performCancelSubscription();
      }
    );
  };

  const performCancelSubscription = async () => {
    setIsLoadingCancel(true);
    
    try {
      const response = await authenticatedRequest(
        `/api/billing/cancel-subscription`,
        {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response) {
        throw new Error("Failed to cancel subscription");
      }

      const result = await response.json();

      if (result.success) {
        const successMessage = t("order_history.cancel_success", {
          date: new Date(result.currentPeriodEnd * 1000).toLocaleDateString()
        });
        
        showToast(successMessage);
        
        // 🎯 使用提取出來的刷新函數
        await refreshSubscriptionStatus();

      } else {
        const errorMessage = t("order_history.cancel_failed_with_error", {
          error: result.error
        });
        showToast(errorMessage);
      }
    } catch (error) {
      console.error("❌ 取消訂閱失敗:", error);
      const errorMessage = t("order_history.cancel_failed");
      showToast(errorMessage);
    } finally {
      setIsLoadingCancel(false);
    }
  };

  const handleViewReceipt = async (order: OrderData) => {
    try {
      const response = await authenticatedRequest(
        `/api/billing/stripe-receipt-url?sessionId=${order.stripe.checkoutSessionId}`
      );

      if (!response) {
        throw new Error("Failed to get receipt URL");
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.receiptUrl) {
        window.open(data.receiptUrl, '_blank');
      } else {
        showToast(t("order_history.receipt_unavailable"));
      }
    } catch (err) {
      console.error("Error getting receipt URL:", err);
      showToast(t("order_history.failed_to_open_receipt"));
    }
  };

  const handleDownloadInvoice = async (order: OrderData) => {
    try {
      if (!order.invoice?.invoiceNumber) {
        showToast(t("order_history.no_invoice"));
        return;
      }

      const invoiceUrl = `https://psf.nyc3.cdn.digitaloceanspaces.com/invoices/${order.invoice.invoiceNumber}.pdf`;
      
      console.log('🔍 嘗試下載發票:', {
        invoiceNumber: order.invoice.invoiceNumber,
        url: invoiceUrl,
        orderReference: order.orderReference
      });

      const link = document.createElement('a');
      link.href = invoiceUrl;
      link.download = `Invoice_${order.invoice.invoiceNumber}.pdf`;
      link.target = '_blank';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ 發票下載連結已觸發');

    } catch (err) {
      console.error("Error downloading invoice:", err);
      showToast(t("order_history.failed_to_download_invoice"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-custom-logo-purple dark:border-white/10 dark:border-t-custom-logo-purple-dark"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {t("order_history.loading_orders")}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 dark:bg-white/[0.06]">
          <AlertCircle className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-custom-logo-purple px-4 py-2 font-medium text-custom-white transition-colors duration-200 hover:bg-custom-logo-purple-hover dark:bg-custom-logo-purple-dark dark:hover:bg-custom-logo-purple-hover-dark"
        >
          {t("order_history.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 🆕 修正：訂閱狀態區塊 */}
      {shouldShowSubscriptionBlock() && (
        <div className="overflow-hidden rounded-2xl bg-custom-white shadow-[0_10px_28px_rgba(46,30,78,0.05)] dark:bg-white/[0.02]">
          <div className="flex items-center gap-4 bg-custom-gray/45 px-5 py-5 dark:bg-white/[0.03]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-custom-logo-purple dark:bg-custom-logo-purple-dark">
              <CreditCard className="w-5 h-5 text-custom-white" />
            </div>
            <div className="flex items-center justify-between w-full">
              <div>
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
                  {t("order_history.current_subscription")}
                </h3>
                <p className="text-sm text-stone-500 dark:text-white/55">
                  {getSafePlanType() || 'Unknown Plan'}
                </p>
              </div>
              
              <div className="flex gap-2">
                {!(subStatus.activeSubscription?.cancelAtPeriodEnd || activeSubscription?.cancelAtPeriodEnd) && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isLoadingCancel}
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2 font-medium text-red-700 transition-colors duration-200 hover:bg-red-100 disabled:opacity-50 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                  >
                    {isLoadingCancel ? (
                      <div className="w-4 h-4 border-2 border-red-700 border-t-transparent rounded-full animate-spin"></div>
                    ) : null}
                    <span className="text-sm">
                      {t("order_history.cancel_subscription")}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-5">
            <div className="flex items-center justify-between rounded-xl bg-custom-gray/35 p-4 dark:bg-white/[0.03]">
              <div>
                <p className="text-sm font-medium text-stone-900 dark:text-white">
                  {(subStatus.activeSubscription?.cancelAtPeriodEnd || activeSubscription?.cancelAtPeriodEnd)
                    ? t("order_history.subscription_end_date")
                    : t("order_history.next_billing")
                  }
                </p>
                <p className="text-sm text-stone-500 dark:text-white/55">
                  {getSafeNextBillingDate()}
                </p>
              </div>
            </div>

            {(subStatus.activeSubscription?.cancelAtPeriodEnd || activeSubscription?.cancelAtPeriodEnd) && (
              <div className="rounded-xl bg-orange-50 p-4 dark:bg-orange-900/20">
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {t("order_history.subscription_cancelled_message", {
                    date: getSafeNextBillingDate()
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 訂單歷史區塊 */}
      <div className="mb-6">
        <h2 className="mb-2 text-xl font-semibold text-stone-900 dark:text-white">
          {t("order_history.title")}
        </h2>
        <p className="mt-2 text-stone-500 dark:text-white/55">
          {t("order_history.description")}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 dark:bg-white/[0.06]">
            <Receipt className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-stone-900 dark:text-white">
            {t("order_history.no_orders")}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {t("order_history.no_orders_message")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order._id}
              order={order}
              onViewReceipt={handleViewReceipt}
              onDownloadInvoice={handleDownloadInvoice}
            />
          ))}
        </div>
      )}

      {/* 確認對話框 */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={dialogState.onConfirm}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
        isLoading={dialogState.isLoading}
        loadingText={dialogState.loadingText}
      />
    </div>
  );
};

export default OrderHistoryView;
