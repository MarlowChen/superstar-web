import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Wand2, 
  X, 
  Sparkles, 
  Palette, 
  Eye
} from 'lucide-react';
import { applyStyleSwitch } from '../../../services/styleSwitcherApi';
import { showToast } from "@/app/components/CustomToast";
import { useTranslations } from "next-intl";
import StyleSelection from "@/app/components/StyleSelection";
import DrawerSelector from "@/app/components/DrawerSelector";
import StyleDialog from "@/app/components/StyleDialog";
import { Style } from "@/app/services/styleSwitcherApi";
import { useAuth } from "@/app/context/AuthContext";
import { StyleData } from './index';

interface StyleTransferProps {
  isActive: boolean;
  onApplyStyle: (styleData: StyleData) => void;
  onClose: () => void;
  imageId: string;
}

const StyleTransfer: React.FC<StyleTransferProps> = ({ 
  isActive, 
  onApplyStyle, 
  onClose,
  imageId
}) => {
  const t = useTranslations("imageEditor");
  const { updateStyle, userSettings } = useAuth();
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [intensity, setIntensity] = useState<number>(80);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isStyleSelectorOpen, setIsStyleSelectorOpen] = useState(false);
  const [showStyleDetails, setShowStyleDetails] = useState(false);

  // 從用戶設定初始化選中的風格
  useEffect(() => {
    if (userSettings && userSettings.selectStyle) {
      setSelectedStyle(userSettings.selectStyle);
    }
  }, [userSettings]);

  const handleSelectStyle = (style: Style) => {
    setSelectedStyle(style);
    updateStyle(style.id);
    setIsStyleSelectorOpen(false);
  };

  const toggleSelectedStyle = (style: Style) => {
    setSelectedStyle(style);
    setShowStyleDetails(true);
  };

  const handleApplyStyle = async () => {
    if (!selectedStyle) {
      showToast(t("style_switch.select_style"), true);
      return;
    }

    setIsProcessing(true);
    
    try {
      // 簡化的風格數據
      const styleData: StyleData = {
        imageId: imageId,      // 照片 ID
        styleId: selectedStyle.id,  // 風格 ID
        intensity: intensity   // 效果強度 (%)
      };
      
      console.log('🎨 套用風格:', styleData);
      
      // 調用 API 進行風格切換
      const result = await applyStyleSwitch(styleData, imageId);
      
      if (result.success) {
        // 成功時調用回調函數
        onApplyStyle(styleData);
        showToast(t("toast.success.style_applied"));
      } else {
        // 顯示錯誤信息
        console.error('風格切換失敗:', result.error?.message);
        showToast(t("toast.error.style_apply_failed", { message: result.error?.message || t("toast.unknown_error") }), true);
      }
    } catch (error) {
      console.error('風格切換異常:', error);
      showToast(t("toast.error.style_apply_error"), true);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isActive) return null;

  return (
    <>
    <div className="fixed inset-0 bg-custom-gray/50 dark:bg-custom-gray-dark/50 flex items-center justify-center z-50 p-4">
        <div className="bg-custom-white dark:bg-custom-white-dark rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* 標題欄 */}
        <div className="flex items-center justify-between p-4 border-b border-custom-light-purple dark:border-custom-light-purple-dark">
          <h3 className="text-lg font-semibold flex items-center text-custom-black dark:text-custom-black-dark">
            <Wand2 className="w-5 h-5 mr-2" />
            {t("style_switch.title")}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark rounded-full transition-colors text-custom-black dark:text-custom-black-dark"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 風格選擇區域 */}
            <div>
              <h4 className="font-medium mb-4 text-custom-black dark:text-custom-black-dark">
                {t("style_switch.select_style")}
              </h4>
              
              <div className="flex items-center gap-4">
                    <button
                  onClick={() => setIsStyleSelectorOpen(true)}
                  className="flex-1 px-4 py-3 bg-custom-gray dark:bg-custom-gray-dark 
                           hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark 
                           text-custom-black dark:text-custom-black-dark 
                           rounded-lg border-2 border-custom-light-purple dark:border-custom-light-purple-dark 
                           hover:border-custom-logo-purple dark:hover:border-custom-logo-purple-dark 
                           transition-all duration-300 text-left"
                >
                  {selectedStyle ? (
                    <div className="flex items-center gap-3">
                      {selectedStyle.cover && (
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                              <Image
                            src={(JSON.parse(selectedStyle.cover as string) as { url?: string })?.url || ""}
                            alt={selectedStyle.name}
                            width={48}
                            height={48}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                      <div>
                        <div className="font-medium">{selectedStyle.name}</div>
                        <div className="text-sm text-custom-black/60 dark:text-custom-black-dark/60">
                          {selectedStyle.description}
                        </div>
                          </div>
                          </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-custom-light-purple dark:bg-custom-light-purple-dark flex items-center justify-center">
                        <Palette className="w-6 h-6 text-custom-black/40 dark:text-custom-black-dark/40" />
                            </div>
                      <div>
                        <div className="font-medium">{t("style_switch.select_style")}</div>
                        <div className="text-sm text-custom-black/60 dark:text-custom-black-dark/60">
                          {t("style_switch.select_from_styles")}
                        </div>
                      </div>
                    </div>
                  )}
                </button>

                {selectedStyle && (
                  <>
                    <button
                      onClick={() => setSelectedStyle(null)}
                      className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    >
                      <X size={18} />
                    </button>
                    <button
                      onClick={() => setShowStyleDetails(true)}
                      className="p-3 bg-custom-logo-purple dark:bg-custom-logo-purple-dark hover:bg-custom-logo-purple-hover dark:hover:bg-custom-logo-purple-hover-dark text-white rounded-lg transition-colors"
                    >
                      <Eye size={18} />
                    </button>
                  </>
              )}
              </div>
            </div>

          {/* 強度調整 */}
            {selectedStyle && (
            <div>
              <h4 className="font-medium mb-3 text-custom-black dark:text-custom-black-dark">
                {t("expression.intensity")} ({intensity}%)
              </h4>
              <div className="space-y-2">
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="w-full accent-custom-logo-purple dark:accent-custom-logo-purple-dark"
                />
                <div className="flex justify-between text-xs text-custom-black/60 dark:text-custom-black-dark/60">
                  <span>{t("style_switch.light_effect")}</span>
                  <span>{t("style_switch.medium_effect")}</span>
                  <span>{t("style_switch.strong_effect")}</span>
                </div>
              </div>
            </div>
          )}

          {/* 處理提示 */}
          {isProcessing && (
            <div className="bg-custom-logo-purple/10 dark:bg-custom-logo-purple-dark/10 p-4 rounded-lg">
              <div className="flex items-center justify-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-custom-logo-purple dark:border-custom-logo-purple-dark"></div>
                <div className="text-custom-black dark:text-custom-black-dark">
                  <div className="font-medium">{t("style_switch.loading")}</div>
                  <div className="text-sm text-custom-black/60 dark:text-custom-black-dark/60">
                    {t("style_transfer.expected_processing_time")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 使用說明 */}
          <div className="bg-custom-light-purple/30 dark:bg-custom-light-purple-dark/30 p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-custom-black dark:text-custom-black-dark flex items-center">
              <Sparkles className="w-4 h-4 mr-2" />
              {t("style_transfer.tips")}
            </h4>
            <ul className="text-sm text-custom-black/60 dark:text-custom-black-dark/60 space-y-1">
              <li>• {t("style_transfer.choose_from_styles")}</li>
              <li>• {t("style_transfer.adjust_intensity")}</li>
              {/* <li>• Popular styles marked with ⭐, recommended to try first</li> */}
              <li>• {t("style_transfer.support_grid_list")}</li>
            </ul>
          </div>
        </div>

        {/* 按鈕區 */}
        <div className="flex justify-end space-x-3 p-4 border-t border-custom-light-purple dark:border-custom-light-purple-dark bg-custom-light-purple/30 dark:bg-custom-light-purple-dark/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-custom-black dark:text-custom-black-dark hover:opacity-70 transition-colors"
            disabled={isProcessing}
          >
            {t("style_switch.cancel")}
          </button>
          <button
            onClick={handleApplyStyle}
              disabled={isProcessing || !selectedStyle}
            className="px-6 py-2 bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white rounded-lg hover:opacity-90 transition-colors flex items-center disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t("common.loading")}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                {t("style_switch.apply")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>

      {/* 風格選擇器抽屜 */}
      <DrawerSelector
        isOpen={isStyleSelectorOpen}
        onClose={() => setIsStyleSelectorOpen(false)}
        title={t("style_switch.select_style")}
        namespace="styles"
      >
        <StyleSelection
          onSelectStyle={handleSelectStyle}
          toggleSelectedStyle={toggleSelectedStyle}
        />
      </DrawerSelector>

      {/* 風格詳情對話框 */}
      <StyleDialog
        isOpen={showStyleDetails}
        onClose={() => setShowStyleDetails(false)}
        style={selectedStyle}
      />
    </>
  );
};

export default StyleTransfer; 