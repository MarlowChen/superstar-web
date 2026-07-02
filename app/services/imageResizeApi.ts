// 圖片尺寸調整 API 服務

// 自定義尺寸調整請求介面
export interface CustomResizeRequest {
  imageId: string;                 // 圖片 ID
  targetSize: {                    // 目標尺寸
    width: number;                 // 目標寬度
    height: number;                // 目標高度
  };
  resizeMode: 'crop' | 'expand';   // 調整模式：裁切或擴圖
  format: string;                  // 輸出格式 (PNG, JPEG, WEBP)
  quality?: number;                // 品質設定 (JPEG 用)
}

// 尺寸調整回應介面
export interface ResizeResponse {
  success: boolean;                // 是否成功
  message: string;                 // 回應訊息
  data?: {                        // 成功時的資料
    resizedImageUrl: string;      // 調整後的圖片 URL
    originalSize: {               // 原始尺寸
      width: number;
      height: number;
    };
    targetSize: {                 // 目標尺寸
      width: number;
      height: number;
    };
    resizeMode: string;           // 使用的調整模式
    format: string;               // 輸出格式
    quality?: number;             // 品質設定
    timestamp: string;            // 處理時間戳
  };
  error?: {                       // 錯誤時的資料
    code: string;                 // 錯誤代碼
    details: string;              // 錯誤詳情
  };
}

// 自定義尺寸資料介面 (前端使用)
export interface CustomResizeData {
  width: number;
  height: number;
  resizeMode: 'crop' | 'expand';
  format: string;
  quality: number;
}

// 資料驗證函數
export const validateCustomResizeData = (data: CustomResizeData): boolean => {
  return (
    data.width > 0 &&
    data.height > 0 &&
    data.width <= 4000 &&
    data.height <= 4000 &&
    ['crop', 'expand'].includes(data.resizeMode) &&
    ['PNG', 'JPEG', 'WEBP'].includes(data.format) &&
    data.quality >= 1 &&
    data.quality <= 100
  );
};

// 轉換前端資料格式為 API 請求格式
export const convertCustomResizeDataToRequest = (
  resizeData: CustomResizeData, 
  imageId: string
): CustomResizeRequest => {
  return {
    imageId: imageId,
    targetSize: {
      width: resizeData.width,
      height: resizeData.height
    },
    resizeMode: resizeData.resizeMode,
    format: resizeData.format,
    quality: resizeData.quality
  };
};

// 自定義尺寸調整 API 呼叫函數
export const resizeImageCustom = async (
  resizeData: CustomResizeData, 
  imageId: string
): Promise<ResizeResponse> => {
  try {
    // 驗證資料
    if (!validateCustomResizeData(resizeData)) {
      throw new Error('自定義尺寸調整資料格式錯誤');
    }

    // 轉換資料格式
    const requestData = convertCustomResizeDataToRequest(resizeData, imageId);

    console.log('發送自定義尺寸調整請求:', requestData);

    // 發送 API 請求
    const response = await fetch('/api/image/resize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('自定義尺寸調整回應:', result);
    
    return result;
  } catch (error) {
    console.error('自定義尺寸調整失敗:', error);
    throw error;
  }
};

// 錯誤處理函數
export const handleResizeError = (error: unknown): string => {
  let errorMessage = '圖片尺寸調整失敗';
  
  // 檢查是否為 API 錯誤回應
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { error?: { code: string; details: string } } } };
    if (apiError.response?.data?.error) {
      const errorData = apiError.response.data.error;
      switch (errorData.code) {
        case 'INVALID_DIMENSIONS':
          errorMessage = '無效的圖片尺寸';
          break;
        case 'UNSUPPORTED_FORMAT':
          errorMessage = '不支援的圖片格式';
          break;
        case 'PROCESSING_TIMEOUT':
          errorMessage = '處理超時';
          break;
        case 'QUALITY_ERROR':
          errorMessage = '品質參數無效';
          break;
        default:
          errorMessage = errorData.details || errorMessage;
      }
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }
  
  return errorMessage;
}; 