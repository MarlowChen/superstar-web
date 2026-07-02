import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  RotateCw, 
  Smartphone, 
  Monitor, 
  Check, 
  X,
  Image as ImageIcon,
  Zap,
  ChevronDown,
  Ruler,
  Scissors,
  Expand,
  Loader2
} from 'lucide-react';
import { 
  CustomResizeData, 
  resizeImageCustom, 
  validateCustomResizeData, 
  handleResizeError 
} from '../../../services/imageResizeApi';
import { showToast } from "@/app/components/CustomToast";
import { useTranslations } from "next-intl";

interface ImageResizerProps {
  isActive: boolean;
  originalWidth: number;
  originalHeight: number;
  onResize: (resizeData: ResizeData) => void;
  onClose: () => void;
  imageId: string; // 新增：圖片 ID
}

interface ResizeData {
  width: number;
  height: number;
  format: string;
  quality: number;
  presetName: string;
}

interface PresetSize {
  id: string;
  name: string;
  width: number;
  height: number;
  ratio: string;
  platform: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

// 下拉選單選項類型
interface FormatDropdownProps {
  options: { value: string; label: string; description: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}

// 格式選擇下拉選單組件
const FormatDropdown: React.FC<FormatDropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  placeholder = "",
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isPositioned, setIsPositioned] = useState<boolean>(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 計算並更新下拉選單位置
  const updatePosition = () => {
    if (!buttonRef.current || !dropdownRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const dropdownRect = dropdownRef.current.getBoundingClientRect();

    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    const actualDropdownHeight = dropdownRect.height;

    // 決定展開方向
    const shouldOpenUpward = spaceBelow < actualDropdownHeight && spaceAbove > spaceBelow;

    let top: number;
    const gap = 4;

    if (shouldOpenUpward) {
      top = buttonRect.top - actualDropdownHeight - gap;
    } else {
      top = buttonRect.bottom + gap;
    }

    // 確保不超出視窗範圍
    if (top < 0) {
      top = gap;
    } else if (top + actualDropdownHeight > viewportHeight) {
      top = viewportHeight - actualDropdownHeight - gap;
    }

    // 水平位置調整
    let left = buttonRect.left;
    const dropdownWidth = buttonRect.width;

    if (left + dropdownWidth > window.innerWidth) {
      left = window.innerWidth - dropdownWidth - gap;
    }

    if (left < 0) {
      left = gap;
    }

    setDropdownStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${dropdownWidth}px`,
      zIndex: 1000,
    });
  };

  // 處理按鈕點擊
  const handleButtonClick = () => {
    if (!isOpen) {
      setIsOpen(true);
      // 延遲定位計算，確保下拉選單已渲染
      setTimeout(() => {
        updatePosition();
        setIsPositioned(true);
      }, 0);
    } else {
      setIsOpen(false);
      setIsPositioned(false);
    }
  };

  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsPositioned(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 監聽視窗變化
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isOpen]);

  const selectedOption = options.find(
    (option) => option.value === selectedValue
  );

  return (
    <>
      <button
        ref={buttonRef}
        className="flex items-center justify-between w-full px-4 py-3 bg-custom-white dark:bg-custom-white-dark 
                 hover:bg-custom-light-purple/20 dark:hover:bg-custom-light-purple-dark/20 
                 border border-custom-light-purple dark:border-custom-light-purple-dark 
                 rounded-lg transition-all duration-200 text-left"
        onClick={handleButtonClick}
        type="button"
      >
        <div className="flex-1">
          <div className="text-sm font-medium text-custom-black dark:text-custom-black-dark">
            {selectedOption?.label || placeholder}
          </div>
          {selectedOption && (
            <div className="text-xs text-custom-black/60 dark:text-custom-black-dark/60 mt-1">
              {selectedOption.description}
            </div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-custom-black/40 dark:text-custom-black-dark/40 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* 使用 Portal 將下拉選單渲染到 body */}
      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className={`transition-all duration-200 ${
              isPositioned ? "opacity-100" : "opacity-0"
            }`}
          >
            <div
              className={`py-1 bg-custom-white dark:bg-custom-white-dark rounded-lg shadow-xl 
                        border border-custom-light-purple dark:border-custom-light-purple-dark
                        max-h-60 overflow-auto ${
                          isPositioned ? "animate-in fade-in-0 zoom-in-95" : ""
                        }`}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  className="w-full flex items-start justify-between px-4 py-3 text-left 
                         hover:bg-custom-light-purple/20 dark:hover:bg-custom-light-purple-dark/20 
                         transition-colors duration-150"
                  onClick={() => {
                    onSelect(option.value);
                    setIsOpen(false);
                    setIsPositioned(false);
                  }}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-custom-black dark:text-custom-black-dark">
                      {option.label}
                    </div>
                    <div className="text-xs text-custom-black/60 dark:text-custom-black-dark/60 mt-1">
                      {option.description}
                    </div>
                  </div>
                  {option.value === selectedValue && (
                    <Check className="w-4 h-4 text-custom-logo-purple dark:text-custom-logo-purple-dark flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

const ImageResizer: React.FC<ImageResizerProps> = ({ 
  isActive, 
  originalWidth, 
  originalHeight, 
  onResize, 
  onClose,
  imageId
}) => {
  const t = useTranslations("imageEditor");
  
  const [selectedPreset, setSelectedPreset] = useState<string>('original');
  const [format, setFormat] = useState<string>('PNG');
  const [quality, setQuality] = useState<number>(90);
  const [showCustomSize, setShowCustomSize] = useState<boolean>(false);
  const [customWidth, setCustomWidth] = useState<number>(1080);
  const [customHeight, setCustomHeight] = useState<number>(720);
  const [resizeMode, setResizeMode] = useState<'crop' | 'expand'>('crop');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 社群媒體尺寸預設 - 依照使用頻率和重要性排序
  const presetSizes: PresetSize[] = [
    {
      id: 'original',
      name: t("resize.presets.original"),
      width: originalWidth,
      height: originalHeight,
      ratio: `${(originalWidth / originalHeight).toFixed(2)}:1`,
      platform: t("resize.original_size"),
      icon: <ImageIcon className="w-5 h-5" />,
      color: 'bg-gray-500',
      description: t("resize.descriptions.original")
    },
    // Facebook 系列
    {
      id: 'fb-cover',
      name: 'Facebook',
      width: 1920,
      height: 1080,
      ratio: '16:9',
      platform: 'Facebook',
      icon: <Monitor className="w-5 h-5" />,
      color: 'bg-blue-600',
      description: t("resize.descriptions.facebook_cover")
    },
    {
      id: 'fb-ad',
      name: 'Facebook',
      width: 1200,
      height: 628,
      ratio: '1.91:1',
      platform: 'Facebook',
      icon: <Monitor className="w-5 h-5" />,
      color: 'bg-blue-600',
      description: t("resize.descriptions.facebook_ad")
    },
    // Instagram 系列
    {
      id: 'ig-post-vertical',
      name: 'Instagram',
      width: 1080,
      height: 1350,
      ratio: '4:5',
      platform: 'Instagram',
      icon: <Smartphone className="w-5 h-5" />,
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
      description: t("resize.descriptions.instagram_square")
    },
    {
      id: 'ig-story',
      name: 'Instagram',
      width: 1080,
      height: 1920,
      ratio: '9:16',
      platform: 'Instagram',
      icon: <Smartphone className="w-5 h-5" />,
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
      description: t("resize.descriptions.instagram_story")
    },
    // X (Twitter) 系列
    {
      id: 'twitter-cover',
      name: 'X (Twitter)',
      width: 1600,
      height: 900,
      ratio: '16:9',
      platform: 'X (Twitter)',
      icon: <Monitor className="w-5 h-5" />,
      color: 'bg-black',
      description: t("resize.descriptions.twitter_header")
    },
    // LinkedIn
    {
      id: 'linkedin-company-cover',
      name: 'LinkedIn',
      width: 1128,
      height: 191,
      ratio: '5.9:1',
      platform: 'LinkedIn',
      icon: <Monitor className="w-5 h-5" />,
      color: 'bg-blue-700',
      description: t("resize.descriptions.linkedin_post")
    },
    // TikTok
    {
      id: 'tiktok-content',
      name: 'TikTok',
      width: 1080,
      height: 1920,
      ratio: '9:16',
      platform: 'TikTok',
      icon: <Smartphone className="w-5 h-5" />,
      color: 'bg-black',
      description: t("resize.descriptions.tiktok_video")
    },
    // YouTube
    {
      id: 'youtube-thumbnail',
      name: 'YouTube',
      width: 1280,
      height: 720,
      ratio: '16:9',
      platform: 'YouTube',
      icon: <Monitor className="w-5 h-5" />,
      color: 'bg-red-600',
      description: t("resize.descriptions.youtube_thumbnail")
    },
  ];

  // 格式選項
  const formatOptions = [
    { value: 'PNG', label: t("resize.formats.PNG"), description: t("resize.format_descriptions.png") },
    { value: 'JPEG', label: t("resize.formats.JPEG"), description: t("resize.format_descriptions.jpeg") },
    { value: 'WEBP', label: t("resize.formats.WEBP"), description: t("resize.format_descriptions.webp") }
  ];

  const handlePresetSelect = (preset: PresetSize) => {
    setSelectedPreset(preset.id);
  };

  const handleApplyResize = async () => {
    if (showCustomSize) {
      // 處理自定義尺寸
      try {
        setIsLoading(true);
        setErrorMessage('');

        const customResizeData: CustomResizeData = {
          width: customWidth,
          height: customHeight,
          resizeMode,
          format,
          quality
        };

        // 驗證資料
        if (!validateCustomResizeData(customResizeData)) {
          throw new Error('Custom resize data format error');
        }

        console.log('準備發送自定義尺寸調整請求:', customResizeData);

        // 呼叫 API
        const response = await resizeImageCustom(customResizeData, imageId);

        if (response.success && response.data) {
          console.log('自定義尺寸調整成功:', response.data);
          
          // 顯示成功提示
          showToast(t("toast.success.image_resized"));
          
          // 呼叫父組件的回調函數
          const resizeData: ResizeData = {
            width: customWidth,
            height: customHeight,
            format,
            quality,
            presetName: `${t("resize.custom_size")} ${customWidth}×${customHeight}`
          };
          onResize(resizeData);
          
          // 關閉編輯器
          onClose();
        } else {
          throw new Error(response.message || 'Custom resize failed');
        }
      } catch (error) {
        console.error('自定義尺寸調整失敗:', error);
        const errorMsg = handleResizeError(error);
        setErrorMessage(errorMsg);
        // 顯示錯誤提示
        showToast(t("toast.error.image_resize_failed", { message: errorMsg }), true);
      } finally {
        setIsLoading(false);
      }
    } else {
      // 處理預設尺寸
      const selectedSize = presetSizes.find(p => p.id === selectedPreset);
      if (!selectedSize) {
        showToast(t("toast.validation.select_size"), true);
        return;
      }

      try {
        // 顯示成功提示
        showToast(t("toast.success.image_resized"));
        
        const resizeData: ResizeData = {
          width: selectedSize.width,
          height: selectedSize.height,
          format,
          quality,
          presetName: selectedSize.name
        };
        onResize(resizeData);
        
        // 關閉編輯器
        onClose();
      } catch (error) {
        console.error('預設尺寸調整失敗:', error);
        showToast(t("toast.error.image_resize_failed", { message: error instanceof Error ? error.message : t("toast.error.preset_resize_failed") }), true);
      }
    }
  };

  const selectedSize = presetSizes.find(p => p.id === selectedPreset);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-custom-gray/50 dark:bg-custom-gray-dark/50 flex items-center justify-center z-50 p-4">
      <div className="bg-custom-white dark:bg-custom-white-dark rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* 標題欄 */}
        <div className="flex items-center justify-between p-4 border-b border-custom-light-purple dark:border-custom-light-purple-dark">
          <h3 className="text-lg font-semibold flex items-center text-custom-black dark:text-custom-black-dark">
            <RotateCw className="w-5 h-5 mr-2" />
            {t("resize.adjust_output_size")}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark rounded-full transition-colors text-custom-black dark:text-custom-black-dark"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 原始尺寸資訊 */}
          <div className="bg-custom-light-purple/30 dark:bg-custom-light-purple-dark/30 p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-custom-black dark:text-custom-black-dark">{t("resize.original_info")}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-custom-black/60 dark:text-custom-black-dark/60">{t("resize.size")}：</span>
                <span className="text-custom-black dark:text-custom-black-dark font-medium">
                  {originalWidth} × {originalHeight} px
                </span>
              </div>
              <div>
                <span className="text-custom-black/60 dark:text-custom-black-dark/60">{t("resize.ratio")}：</span>
                <span className="text-custom-black dark:text-custom-black-dark font-medium">
                  {(originalWidth / originalHeight).toFixed(2)}:1
                </span>
              </div>
            </div>
          </div>

          {/* 社群媒體尺寸選擇 */}
          <div>
            <h4 className="font-medium mb-4 text-custom-black dark:text-custom-black-dark">
              {t("resize.select_output_size")}
            </h4>
            
            {/* 自定義尺寸切換按鈕 */}
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => setShowCustomSize(false)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  !showCustomSize 
                    ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark border-custom-logo-purple dark:border-custom-logo-purple-dark text-custom-white dark:text-custom-white' 
                    : 'border-custom-light-purple dark:border-custom-light-purple-dark hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark text-custom-black dark:text-custom-black-dark'
                }`}
              >
                {t("resize.preset_size")}
              </button>
              <button
                onClick={() => setShowCustomSize(true)}
                className={`px-4 py-2 rounded-lg border transition-colors flex items-center ${
                  showCustomSize 
                    ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark border-custom-logo-purple dark:border-custom-logo-purple-dark text-custom-white dark:text-custom-white' 
                    : 'border-custom-light-purple dark:border-custom-light-purple-dark hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark text-custom-black dark:text-custom-black-dark'
                }`}
              >
                <Ruler className="w-4 h-4 mr-2" />
                {t("resize.custom_size")}
              </button>
            </div>

            {!showCustomSize ? (
              // 預設尺寸選擇
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                {presetSizes.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={`p-2 border-2 rounded-lg text-left transition-all duration-200 hover:scale-[1.02] ${
                      selectedPreset === preset.id
                        ? 'border-custom-logo-purple dark:border-custom-logo-purple-dark bg-custom-logo-purple/10 dark:bg-custom-logo-purple-dark/10'
                        : 'border-custom-light-purple dark:border-custom-light-purple-dark hover:border-custom-logo-purple dark:hover:border-custom-logo-purple-dark'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      <div className={`p-1.5 rounded-lg ${preset.color} text-white flex-shrink-0`}>
                        {preset.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-custom-black dark:text-custom-black-dark text-xs leading-tight">
                          {preset.name}
                        </div>
                        <div className="text-xs text-custom-black/60 dark:text-custom-black-dark/60 mt-1 line-clamp-1">
                          {preset.description}
                        </div>
                        <div className="flex items-center justify-end mt-1">
                          <span className="text-xs text-custom-black/60 dark:text-custom-black-dark/60">
                            {preset.ratio}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              // 自定義尺寸輸入
              <div className="space-y-4">
                {/* 尺寸輸入 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-custom-black dark:text-custom-black-dark">
                      {t("resize.width")}
                    </label>
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value))}
                      min="1"
                      max="4000"
                      className="w-full p-3 border border-custom-light-purple dark:border-custom-light-purple-dark rounded-lg focus:ring-2 focus:ring-custom-logo-purple dark:focus:ring-custom-logo-purple-dark focus:border-custom-logo-purple dark:focus:border-custom-logo-purple-dark bg-custom-white dark:bg-custom-white-dark text-custom-black dark:text-custom-black-dark"
                      placeholder="1080"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-custom-black dark:text-custom-black-dark">
                      {t("resize.height")}
                    </label>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Number(e.target.value))}
                      min="1"
                      max="4000"
                      className="w-full p-3 border border-custom-light-purple dark:border-custom-light-purple-dark rounded-lg focus:ring-2 focus:ring-custom-logo-purple dark:focus:ring-custom-logo-purple-dark focus:border-custom-logo-purple dark:focus:border-custom-logo-purple-dark bg-custom-white dark:bg-custom-white-dark text-custom-black dark:text-custom-black-dark"
                      placeholder="720"
                    />
                  </div>
                </div>

                {/* 調整模式選擇 */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-custom-black dark:text-custom-black-dark">
                    {t("resize.adjust_mode")}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setResizeMode('crop')}
                      className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                        resizeMode === 'crop'
                          ? 'border-custom-logo-purple dark:border-custom-logo-purple-dark bg-custom-logo-purple/10 dark:bg-custom-logo-purple-dark/10'
                          : 'border-custom-light-purple dark:border-custom-light-purple-dark hover:border-custom-logo-purple dark:hover:border-custom-logo-purple-dark'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="p-2 rounded-lg bg-red-500 text-white">
                          <Scissors className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-custom-black dark:text-custom-black-dark">
                            {t("resize.crop_mode")}
                          </div>
                          <div className="text-xs text-custom-black/60 dark:text-custom-black-dark/60 mt-1">
                            {t("resize.crop_description")}
                          </div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setResizeMode('expand')}
                      className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                        resizeMode === 'expand'
                          ? 'border-custom-logo-purple dark:border-custom-logo-purple-dark bg-custom-logo-purple/10 dark:bg-custom-logo-purple-dark/10'
                          : 'border-custom-light-purple dark:border-custom-light-purple-dark hover:border-custom-logo-purple dark:hover:border-custom-logo-purple-dark'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="p-2 rounded-lg bg-blue-500 text-white">
                          <Expand className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-custom-black dark:text-custom-black-dark">
                            {t("resize.expand_mode")}
                          </div>
                          <div className="text-xs text-custom-black/60 dark:text-custom-black-dark/60 mt-1">
                            {t("resize.expand_description")}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 尺寸預覽 */}
                <div className="bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 p-4 rounded-lg">
                  <h4 className="font-medium mb-3 text-custom-black dark:text-custom-black-dark flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    {t("resize.custom_preview")}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="block text-custom-black/60 dark:text-custom-black-dark/60">{t("resize.target_size")}</span>
                      <span className="text-custom-black dark:text-custom-black-dark font-medium">
                        {customWidth} × {customHeight}
                      </span>
                    </div>
                    <div>
                      <span className="block text-custom-black/60 dark:text-custom-black-dark/60">{t("resize.ratio")}</span>
                      <span className="text-custom-black dark:text-custom-black-dark font-medium">
                        {(customWidth / customHeight).toFixed(2)}:1
                      </span>
                    </div>
                    <div>
                      <span className="block text-custom-black/60 dark:text-custom-black-dark/60">{t("resize.adjust_mode")}</span>
                      <span className="text-custom-black dark:text-custom-black-dark font-medium">
                        {resizeMode === 'crop' ? t("resize.crop") : t("resize.expand")}
                      </span>
                    </div>
                    <div>
                      <span className="block text-custom-black/60 dark:text-custom-black-dark/60">{t("resize.compare_original")}</span>
                      <span className="text-custom-black dark:text-custom-black-dark font-medium">
                        {customWidth > originalWidth || customHeight > originalHeight ? t("resize.zoom_in") : t("resize.zoom_out")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 當前選擇預覽 */}
          {selectedSize && (
            <div className="bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 p-4 rounded-lg">
              <h4 className="font-medium mb-3 text-custom-black dark:text-custom-black-dark flex items-center">
                <Zap className="w-4 h-4 mr-2" />
                {t("resize.output_preview")}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="block text-custom-black/60 dark:text-custom-black-dark/60">{t("resize.platform")}</span>
                  <span className="text-custom-black dark:text-custom-black-dark font-medium">
                    {selectedSize.platform}
                  </span>
                </div>
                <div>
                  <span className="block text-custom-black/60 dark:text-custom-black-dark/60">{t("resize.size")}</span>
                  <span className="text-custom-black dark:text-custom-black-dark font-medium">
                    {selectedSize.width} × {selectedSize.height}
                  </span>
                </div>
                <div>
                  <span className="block text-custom-black/60 dark:text-custom-black-dark/60">{t("resize.ratio")}</span>
                  <span className="text-custom-black dark:text-custom-black-dark font-medium">
                    {selectedSize.ratio}
                  </span>
                </div>
                <div>
                  <span className="block text-custom-black/60 dark:text-custom-black-dark/60">{t("resize.name")}</span>
                  <span className="text-custom-black dark:text-custom-black-dark font-medium">
                    {selectedSize.description}

                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 輸出格式選擇 */}
          <div> 
            <h4 className="font-medium mb-3 text-custom-black dark:text-custom-black-dark">
              {t("resize.output_format")}
            </h4>
            <FormatDropdown
              options={formatOptions}
              selectedValue={format}
              onSelect={setFormat}
              placeholder={t("text_editor.select_output_format")}
            />
          </div>

          {/* JPEG 品質設定 */}
          {format === 'JPEG' && (
            <div>
              <h4 className="font-medium mb-3 text-custom-black dark:text-custom-black-dark">
                圖片品質 ({quality}%)
              </h4>
              <input
                type="range"
                min="50"
                max="100"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-custom-logo-purple dark:accent-custom-logo-purple-dark"
              />
              <div className="flex justify-between text-xs text-custom-black/60 dark:text-custom-black-dark/60 mt-1">
                <span>{t("resize.compression_more")}</span>
                <span>{t("resize.quality_best")}</span>
              </div>
            </div>
          )}
        </div>

        {/* 錯誤訊息 */}
        {errorMessage && (
          <div className="p-4 border-t border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <div className="text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </div>
          </div>
        )}

        {/* 按鈕區 */}
        <div className="flex justify-end space-x-3 p-4 border-t border-custom-light-purple dark:border-custom-light-purple-dark bg-custom-light-purple/30 dark:bg-custom-light-purple-dark/30">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-custom-black dark:text-custom-black-dark hover:opacity-70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("resize.cancel")}
          </button>
          <button
            onClick={handleApplyResize}
            disabled={isLoading || (showCustomSize && (customWidth <= 0 || customHeight <= 0))}
            className="px-6 py-2 bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("ui.processing")}
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t("resize.apply_size")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageResizer; 



