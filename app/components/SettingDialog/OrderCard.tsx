import React from "react";
import {
  ExternalLink,
  Calendar,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Receipt,
  Coins,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { OrderData } from "./OrderInterfaces";

interface OrderCardProps {
  order: OrderData;
  onViewReceipt: (order: OrderData) => void;
  onDownloadInvoice: (order: OrderData) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ 
  order, 
  onViewReceipt, 
  onDownloadInvoice 
}) => {
  const locale = useLocale();
  const t = useTranslations("settings");

  // 獲取點數授予數量，優先使用 productInfo.pointsGranted
  const getPointsGranted = () => {
    return order.productInfo?.pointsGranted ?? order.pointsGranted;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === 'zh-TW' ? 'zh-TW' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat(locale === 'zh-TW' ? 'zh-TW' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getTransactionTypeDisplay = (type: string) => {
    const typeMap: Record<string, string> = {
      'PAYG': t("order_history.transaction_type_payg"),
      'PLUS': t("order_history.plus_plan"),
      'STANDARD': t("order_history.standard_plan"),
      'PRO': t("order_history.pro_plan"),
      'MAX': t("order_history.max_plan")
    };
    return typeMap[type] || type;
  };

  const getStatusDisplay = (status: string) => {
    const statusConfig = {
      completed: {
        icon: <CheckCircle className="w-4 h-4" />,
        text: t("order_history.status_completed"),
        className: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20'
      },
      pending: {
        icon: <Clock className="w-4 h-4" />,
        text: t("order_history.status_pending"),
        className: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20'
      },
      failed: {
        icon: <AlertCircle className="w-4 h-4" />,
        text: t("order_history.status_failed"),
        className: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20'
      }
    };

    const normalizedStatus = status.toLowerCase() as keyof typeof statusConfig;
    
    return statusConfig[normalizedStatus] || {
      icon: <Clock className="w-4 h-4" />,
      text: status,
      className: 'text-stone-600 dark:text-white/55 bg-stone-50 dark:bg-white/[0.04]'
    };
  };

  const statusDisplay = getStatusDisplay(order.payment.status);

  return (
    <div className="rounded-2xl bg-custom-white p-4 transition-all duration-200 hover:shadow-[0_10px_28px_rgba(46,30,78,0.06)] sm:p-6 dark:bg-white/[0.02]">
      {/* 桌面版佈局 */}
      <div className="hidden sm:block">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
                {order.orderReference}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.className}`}>
                {statusDisplay.icon}
                {statusDisplay.text}
              </span>
            </div>
            <p className="text-sm text-stone-500 dark:text-white/55">
              {getTransactionTypeDisplay(order.transactionType)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-custom-logo-purple dark:text-custom-logo-purple-dark">
              {formatAmount(order.payment.amount, order.payment.currency)}
            </p>
            {(getPointsGranted() !== undefined && getPointsGranted() !== null) && (
              <p className="flex items-center justify-end gap-1 text-sm text-stone-500 dark:text-white/55">
                <Coins className="w-3 h-3" />
                +{getPointsGranted()} {t("order_history.points")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 text-sm">
          <div className="flex items-center gap-2 text-stone-500 dark:text-white/55">
            <Calendar className="w-4 h-4" />
            <span>{t("order_history.payment_date")}:</span>
            <span className="text-stone-900 dark:text-white">
              {formatDate(order.payment.paymentDate)}
            </span>
          </div>
          
          {order.invoice?.invoiceNumber && (
            <div className="flex items-center gap-2 text-stone-500 dark:text-white/55">
              <Receipt className="w-4 h-4" />
              <span className="font-mono text-xs text-stone-900 dark:text-white">
                {order.invoice.invoiceNumber}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 手機版佈局 */}
      <div className="sm:hidden">
        {/* 訂單編號與狀態 */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="truncate pr-2 text-base font-semibold text-stone-900 dark:text-white">
              {order.orderReference}
            </h3>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${statusDisplay.className}`}>
              {statusDisplay.icon}
              {statusDisplay.text}
            </span>
          </div>
          <p className="text-sm text-stone-500 dark:text-white/55">
            {getTransactionTypeDisplay(order.transactionType)}
          </p>
        </div>

        {/* 金額與點數 */}
        <div className="mb-3">
          <p className="text-xl font-bold text-custom-logo-purple dark:text-custom-logo-purple-dark mb-1">
            {formatAmount(order.payment.amount, order.payment.currency)}
          </p>
          {(getPointsGranted() !== undefined && getPointsGranted() !== null) && (
            <p className="flex items-center gap-1 text-sm text-stone-500 dark:text-white/55">
              <Coins className="w-3 h-3" />
              +{getPointsGranted()} {locale === 'zh-TW' ? '點數' : 'points'}
            </p>
          )}
        </div>

        {/* 付款時間 */}
        <div className="mb-3">
          <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-white/55">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="flex-shrink-0">{t("order_history.payment_date")}:</span>
          </div>
          <p className="ml-6 mt-1 text-sm text-stone-900 dark:text-white">
            {formatDate(order.payment.paymentDate)}
          </p>
        </div>
        
        {/* 發票編號 */}
        {order.invoice?.invoiceNumber && (
          <div className="mb-3">
            <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-white/55">
              <Receipt className="w-4 h-4 flex-shrink-0" />
              <span className="flex-shrink-0">{t("order_history.invoice_number")}:</span>
            </div>
            <p className="ml-6 mt-1 font-mono text-sm text-stone-900 dark:text-white">
              {order.invoice.invoiceNumber}
            </p>
          </div>
        )}
      </div>

      <div className="pt-4">
        {/* 桌面版按鈕 */}
        <div className="hidden sm:flex flex-row gap-3">
          <button
            onClick={() => onViewReceipt(order)}
            className="flex items-center justify-center gap-2 rounded-xl bg-custom-logo-purple px-4 py-2 font-medium text-custom-white transition-colors duration-200 hover:bg-custom-logo-purple-hover dark:bg-custom-logo-purple-dark dark:hover:bg-custom-logo-purple-hover-dark"
          >
            <ExternalLink className="w-4 h-4" />
            {t("order_history.view_receipt")}
          </button>
          
          {order.invoice?.invoiceNumber && (
            <button
              onClick={() => onDownloadInvoice(order)}
              className="flex items-center justify-center gap-2 rounded-xl bg-custom-gray px-4 py-2 font-medium text-stone-900 transition-colors duration-200 hover:bg-custom-light-purple dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
            >
              <Download className="w-4 h-4" />
              {t("order_history.download_invoice")}
            </button>
          )}
        </div>

        {/* 手機版按鈕 */}
        <div className="sm:hidden space-y-2">
          <button
            onClick={() => onViewReceipt(order)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-custom-logo-purple px-4 py-3 text-sm font-medium text-custom-white transition-colors duration-200 hover:bg-custom-logo-purple-hover dark:bg-custom-logo-purple-dark dark:hover:bg-custom-logo-purple-hover-dark"
          >
            <ExternalLink className="w-4 h-4" />
            {t("order_history.view_receipt")}
          </button>
          
          {order.invoice?.invoiceNumber && (
            <button
              onClick={() => onDownloadInvoice(order)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-custom-gray px-4 py-3 text-sm font-medium text-stone-900 transition-colors duration-200 hover:bg-custom-light-purple dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
            >
              <Download className="w-4 h-4" />
              {t("order_history.download_invoice")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderCard;
