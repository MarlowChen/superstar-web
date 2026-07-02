import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  X, 
  Check, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  ExpressionData, 
  changeExpression, 
  validateExpressionData, 
  handleExpressionError 
} from '../../../services/expressionChangerApi';
import { showToast } from "@/app/components/CustomToast";
import { useTranslations } from "next-intl";

interface ExpressionChangerProps {
  isActive: boolean;
  onExpressionChange: (data: ExpressionData) => void;
  onClose: () => void;
  imageId: string; // 新增：圖片 ID
}


const ExpressionChanger: React.FC<ExpressionChangerProps> = ({ 
  isActive, 
  onExpressionChange, 
  onClose,
  imageId
}) => {
  const t = useTranslations("imageEditor");
  const [selectedExpression, setSelectedExpression] = useState<ExpressionData['type']>('happy');
  const [selectedPose, setSelectedPose] = useState<ExpressionData['pose']>('standing');
  const [intensity, setIntensity] = useState<number>(50);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 檢測移動設備
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const expressions = [
    { type: 'happy' as const, label: t("expression.expressions.happy"), emoji: '😊' },
    { type: 'sad' as const, label: t("expression.expressions.sad"), emoji: '😢' },
    { type: 'angry' as const, label: t("expression.expressions.angry"), emoji: '😠' },
    { type: 'surprised' as const, label: t("expression.expressions.surprised"), emoji: '😮' },
    { type: 'neutral' as const, label: t("expression.expressions.neutral"), emoji: '😐' }
  ];

  const poses = [
    { type: 'standing' as const, label: t("expression.poses.standing"), icon: '🧍' },
    { type: 'sitting' as const, label: t("expression.poses.sitting"), icon: '🧎' },
    { type: 'walking' as const, label: t("expression.poses.walking"), icon: '🚶' },
    { type: 'running' as const, label: t("expression.poses.running"), icon: '🏃' },
    { type: 'dancing' as const, label: t("expression.poses.dancing"), icon: '💃' },
    { type: 'pointing' as const, label: t("expression.poses.pointing"), icon: '👆' },
    { type: 'waving' as const, label: t("expression.poses.waving"), icon: '👋' },
    { type: 'neutral' as const, label: t("expression.poses.neutral"), icon: '🙂' }
  ];

  const handleApply = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');

      const expressionData: ExpressionData = {
        type: selectedExpression,
        pose: selectedPose,
        intensity
      };

      // 驗證資料
      if (!validateExpressionData(expressionData)) {
        throw new Error('表情姿勢資料格式錯誤');
      }

      console.log('準備發送表情姿勢調整請求:', expressionData);

      // 呼叫 API
      const response = await changeExpression(expressionData, imageId);

      if (response.success && response.data) {
        console.log('表情姿勢調整成功:', response.data);
        
        // 顯示成功提示
        showToast(t("toast.success.expression_changed"));
        
        // 呼叫父組件的回調函數
        onExpressionChange(expressionData);
        
        // 關閉編輯器
        onClose();
      } else {
        throw new Error(response.error?.message || '表情姿勢調整失敗');
      }
    } catch (error) {
      console.error('表情姿勢調整失敗:', error);
      const errorMsg = handleExpressionError(error);
      setErrorMessage(errorMsg);
      // 顯示錯誤提示
      showToast(t("toast.error.expression_change_failed", { message: errorMsg }), true);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-custom-gray/50 dark:bg-custom-gray-dark/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-custom-white dark:bg-custom-white-dark rounded-lg shadow-xl w-full ${isMobile ? 'max-w-sm mx-2' : 'max-w-md'} flex flex-col ${isMobile ? 'max-h-[90vh]' : 'max-h-[85vh]'} ${isMobile ? 'touch-pan-y' : ''}`}>
        {/* 標題欄 - 固定 */}
        <div className={`flex items-center justify-between ${isMobile ? 'p-3' : 'p-4'} border-b border-custom-light-purple dark:border-custom-light-purple-dark flex-shrink-0`}>
          <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold flex items-center text-custom-black dark:text-custom-black-dark`}>
            <Palette className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mr-2`} />
            {t("expression.title")}
          </h3>
          <button onClick={onClose} className={`${isMobile ? 'p-2' : 'p-2'} hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark rounded-full text-custom-black dark:text-custom-black-dark transition-colors ${isMobile ? 'touch-manipulation' : ''}`}>
            <X className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'}`} />
          </button>
        </div>

        {/* 內容區域 - 可滾動 */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-3' : 'p-4'} space-y-6`}>
          {/* 表情選擇 */}
          <div>
            <h4 className={`${isMobile ? 'text-sm' : 'text-base'} font-medium mb-3 text-custom-black dark:text-custom-black-dark`}>
              {t("expression.expression")}
            </h4>
            <div className="grid grid-cols-5 gap-2">
              {expressions.map((expression) => (
                <button
                  key={expression.type}
                  onClick={() => setSelectedExpression(expression.type)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedExpression === expression.type
                      ? 'border-custom-logo-purple dark:border-custom-logo-purple-dark bg-custom-logo-purple/10 dark:bg-custom-logo-purple-dark/10'
                      : 'border-custom-light-purple dark:border-custom-light-purple-dark hover:border-custom-logo-purple/50 dark:hover:border-custom-logo-purple-dark/50'
                  }`}
                >
                  <div className="text-2xl mb-1">{expression.emoji}</div>
                  <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-custom-black dark:text-custom-black-dark`}>
                    {expression.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 姿勢選擇 */}
          <div>
            <h4 className={`${isMobile ? 'text-sm' : 'text-base'} font-medium mb-3 text-custom-black dark:text-custom-black-dark`}>
              {t("expression.pose")}
            </h4>
            <div className="grid grid-cols-4 gap-2">
              {poses.map((pose) => (
                <button
                  key={pose.type}
                  onClick={() => setSelectedPose(pose.type)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedPose === pose.type
                      ? 'border-custom-logo-purple dark:border-custom-logo-purple-dark bg-custom-logo-purple/10 dark:bg-custom-logo-purple-dark/10'
                      : 'border-custom-light-purple dark:border-custom-light-purple-dark hover:border-custom-logo-purple/50 dark:hover:border-custom-logo-purple-dark/50'
                  }`}
                >
                  <div className="text-xl mb-1">{pose.icon}</div>
                  <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-custom-black dark:text-custom-black-dark`}>
                    {pose.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 強度調整 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className={`${isMobile ? 'text-sm' : 'text-base'} font-medium text-custom-black dark:text-custom-black-dark`}>
                {t("expression.adjust_intensity")}
              </h4>
              <span className={`${isMobile ? 'text-sm' : 'text-base'} text-custom-black/60 dark:text-custom-black-dark/60`}>
                {intensity}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="w-full h-2 bg-custom-light-purple dark:bg-custom-light-purple-dark rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-custom-black/40 dark:text-custom-black-dark/40 mt-1">
              <span>{t("expression.light")}</span>
              <span>{t("expression.strong")}</span>
            </div>
          </div>

          {/* 錯誤訊息 */}
          {errorMessage && (
            <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-3 rounded-lg">
              <div className="flex items-start text-red-700 dark:text-red-400">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* 提示信息 */}
          <div className="bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 p-3 rounded-lg">
            <div className="flex items-start text-custom-black dark:text-custom-black-dark">
              <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-sm">
                {t("expression.ai_description")}
              </span>
            </div>
          </div>
        </div>

        {/* 底部按鈕 - 固定 */}
        <div className={`flex justify-end space-x-3 ${isMobile ? 'p-3' : 'p-4'} border-t border-custom-light-purple dark:border-custom-light-purple-dark bg-custom-light-purple/30 dark:bg-custom-light-purple-dark/30 flex-shrink-0`}>
          <button
            onClick={onClose}
            className={`${isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'} text-custom-black dark:text-custom-black-dark hover:opacity-70 transition-colors`}
          >
            {t("expression.cancel")}
          </button>
          <button
            onClick={handleApply}
            disabled={isLoading}
            className={`${isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'} bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white rounded-lg hover:opacity-90 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            {isLoading ? t("common.loading") : t("expression.apply")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpressionChanger; 