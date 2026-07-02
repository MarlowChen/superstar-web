import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
  loadingText?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'info',
  isLoading = false,
  loadingText,
}) => {
  const t = useTranslations("common");
  const locale = useLocale();

  // 根據變體獲取圖標和顏色
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-red-500" />,
          confirmButton: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
          iconBg: "bg-red-50 dark:bg-red-900/20",
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
          confirmButton: "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
          iconBg: "bg-yellow-50 dark:bg-yellow-900/20",
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-6 h-6 text-green-500" />,
          confirmButton: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
          iconBg: "bg-green-50 dark:bg-green-900/20",
        };
      default:
        return {
          icon: <Info className="w-6 h-6 text-blue-500" />,
          confirmButton: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
          iconBg: "bg-blue-50 dark:bg-blue-900/20",
        };
    }
  };

  const variantStyles = getVariantStyles();

  const defaultTexts = {
    confirm: locale === "zh-TW" ? "確認" : "Confirm",
    cancel: locale === "zh-TW" ? "取消" : "Cancel",
    loading: locale === "zh-TW" ? "處理中..." : "Processing...",
  };

  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] transition-opacity duration-300 ease-out" />
        <Dialog.Content className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700 shadow-xl transform transition-all duration-300 ease-out scale-100">
            {/* Close button */}
            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label={locale === 'zh-TW' ? '關閉對話框' : 'Close dialog'}
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>

            {/* Dialog content */}
            <div className="mb-6">
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 p-2 rounded-full ${variantStyles.iconBg}`}>
                  {variantStyles.icon}
                </div>
                <div className="flex-1">
                  <Dialog.Title className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                    {title}
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {message}
                  </Dialog.Description>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50"
                >
                  {cancelText || defaultTexts.cancel}
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 flex items-center justify-center ${variantStyles.confirmButton}`}
                title={t("confirm")}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    {loadingText || defaultTexts.loading}
                  </>
                ) : (
                  confirmText || defaultTexts.confirm
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ConfirmDialog; 