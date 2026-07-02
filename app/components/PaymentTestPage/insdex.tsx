"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Check, X, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { showToast } from '../CustomToast';
import { useAuth } from '@/app/context/AuthContext';

// 定義具體的類型而不是使用 any
interface Subscription {
  transactionType: string;
  subscription?: {
    subscriptionStatus: string;
    currentPeriodEnd: string;
  };
  stripe?: {
    subscriptionId: string;
  };
}

interface UserStatus {
  subscription: Subscription | null;
}

const PaymentTestPage: React.FC = () => {
  const { user, authenticatedRequest } = useAuth();
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null); // 'PLUS' | 'PAYG' | null

  // 載入用戶狀態 - 使用 useCallback 來避免重複創建
  const loadUserStatus = useCallback(async () => {
    if (!user) {
      setError('請先登入');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedRequest(`${process.env.NEXT_PUBLIC_SERVER_URL}/user-status`);
      
      if (response) {
        const status = await response.json();
        setUserStatus(status);
        console.log('✅ 用戶狀態載入成功:', status);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '載入用戶狀態失敗';
      setError(errorMessage);
      console.error('❌ 載入用戶狀態失敗:', err);
    } finally {
      setLoading(false);
    }
  }, [user, authenticatedRequest]);

  // 處理付款
  const handlePayment = async (transactionType: 'PLUS' | 'PAYG') => {
    if (!user) {
      showToast('請先登入', true);
      return;
    }

    setPaymentLoading(transactionType);
    setError(null);

    try {
      console.log('🚀 開始創建付款會話:', transactionType);
      
      const response = await authenticatedRequest(`${process.env.NEXT_PUBLIC_SERVER_URL}/create-checkout`, {
        method: 'POST',
        body: JSON.stringify({ transactionType }),
      });

      if (response) {
        const { sessionId, url } = await response.json();
        
        console.log('✅ 付款會話創建成功:', { sessionId, url });
        showToast(`付款會話創建成功！Session ID: ${sessionId}`);
        
        // 跳轉到 Stripe Checkout
        if (url) {
          console.log('🔄 跳轉到 Stripe Checkout:', url);
          window.location.href = url;
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '付款處理失敗';
      setError(errorMessage);
      showToast(errorMessage, true);
      console.error('❌ 付款失敗:', err);
    } finally {
      setPaymentLoading(null);
    }
  };

  // 處理取消訂閱
  const handleCancelSubscription = async () => {
    if (!user) {
      showToast('請先登入', true);
      return;
    }

    if (!confirm('確定要取消訂閱嗎？')) return;

    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedRequest(`${process.env.NEXT_PUBLIC_SERVER_URL}/cancel-subscription`, {
        method: 'POST',
      });

      if (response) {
        const result = await response.json();
        showToast(result.message || '訂閱已成功取消');
        await loadUserStatus(); // 重新載入狀態
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '取消訂閱失敗';
      setError(errorMessage);
      showToast(errorMessage, true);
    } finally {
      setLoading(false);
    }
  };

  // 初始載入
  useEffect(() => {
    if (user) {
      loadUserStatus();
    }
  }, [user, loadUserStatus]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6 text-center">
          <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-yellow-700 dark:text-yellow-300">請先登入以使用付款功能</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center">
          <CreditCard className="mr-2" />
          付款系統測試
        </h1>

        {/* 用戶信息 */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900 rounded-md">
          <h3 className="font-semibold mb-2">登入用戶</h3>
          <p><strong>用戶 ID:</strong> {user.id}</p>
          <p><strong>Email:</strong> {user.email}</p>
        </div>

        {/* 錯誤提示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        {/* 用戶狀態 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">目前訂閱狀態</h3>
            <button
              onClick={loadUserStatus}
              disabled={loading}
              className="flex items-center px-3 py-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-md transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              重新載入
            </button>
          </div>

          {loading ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              載入中...
            </div>
          ) : userStatus ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
              {userStatus.subscription ? (
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-2" />
                    <span className="font-medium text-green-700 dark:text-green-300">已訂閱</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>訂閱類型:</strong> {userStatus.subscription.transactionType || 'N/A'}</p>
                    <p><strong>訂閱狀態:</strong> {userStatus.subscription.subscription?.subscriptionStatus || 'N/A'}</p>
                    <p><strong>Stripe 訂閱 ID:</strong> {userStatus.subscription.stripe?.subscriptionId || 'N/A'}</p>
                    {userStatus.subscription.subscription?.currentPeriodEnd && (
                      <p><strong>下次計費日期:</strong> {new Date(userStatus.subscription.subscription.currentPeriodEnd).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center">
                  <X className="w-5 h-5 text-gray-500 mr-2" />
                  <span className="text-gray-600 dark:text-gray-400">目前沒有活躍的訂閱</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md text-center text-gray-500">
              點擊重新載入獲取狀態
            </div>
          )}
        </div>

        {/* 付款選項 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Plus 訂閱 */}
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <CreditCard className="w-5 h-5 mr-2" />
              Plus 訂閱
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              $20/月，每月 2000 點數
            </p>
            <ul className="space-y-2 mb-4 text-sm">
              <li className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                每月 2000 點數
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                自動續費
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                優先支援
              </li>
            </ul>
            <button
              onClick={() => handlePayment('PLUS')}
              disabled={paymentLoading === 'PLUS' || loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center"
            >
              {paymentLoading === 'PLUS' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  處理中...
                </>
              ) : (
                '訂閱 Plus'
              )}
            </button>
          </div>

          {/* PAYG 一次性 */}
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <CreditCard className="w-5 h-5 mr-2" />
              PAYG 點數包
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              $10，一次性購買 600 點數
            </p>
            <ul className="space-y-2 mb-4 text-sm">
              <li className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                600 點數
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                永不過期
              </li>
              <li className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                按需購買
              </li>
            </ul>
            <button
              onClick={() => handlePayment('PAYG')}
              disabled={paymentLoading === 'PAYG' || loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center"
            >
              {paymentLoading === 'PAYG' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  處理中...
                </>
              ) : (
                '購買點數'
              )}
            </button>
          </div>
        </div>

        {/* 管理訂閱 */}
        {userStatus?.subscription && (
          <div className="mt-6 p-4 border border-orange-200 dark:border-orange-700 rounded-md">
            <h3 className="font-semibold mb-2">訂閱管理</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              當前訂閱狀態：{userStatus.subscription.subscription?.subscriptionStatus || 'Unknown'}
            </p>
            <button
              onClick={handleCancelSubscription}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-md transition-colors flex items-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  取消訂閱
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 測試說明 */}
      <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
        <h3 className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
          💡 測試說明
        </h3>
        <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
          <li>• 確保後端 Express 服務正在運行</li>
          <li>• 檢查 Stripe 環境變數 STRIPE_SECRET_KEY 是否正確設定</li>
          <li>• 檢查 STRIPE_PLUS_PRICE_ID 和 STRIPE_PAYG_PRICE_ID 是否正確</li>
          <li>• 測試卡號：4242 4242 4242 4242 (任何未來到期日和 CVC)</li>
          <li>• 查看瀏覽器開發者工具的 Network 和 Console 面板</li>
          <li>• 查看後端控制台的 log 輸出</li>
        </ul>
      </div>

      {/* Debug 信息 */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-sm">🔍 Debug Info</h3>
        <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
          <p>API Base URL: {process.env.NEXT_PUBLIC_SERVER_URL}</p>
          <p>User ID: {user?.id}</p>
          <p>Payment Loading: {paymentLoading || 'None'}</p>
          <p>Last Error: {error || 'None'}</p>
          <p>Has Subscription: {userStatus?.subscription ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentTestPage;
