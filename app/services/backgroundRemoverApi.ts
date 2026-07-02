// 背景移除 API 服務

// 背景移除請求介面
export interface BackgroundRemoveRequest {
  imageId: string;                 // 圖片 ID
  options?: {                      // 可選設定
    quality: 'high'; // 處理品質
    format: 'PNG';        // 輸出格式
    keepShadows?: boolean;         // 是否保留陰影
    enhanceEdges?: boolean;        // 是否增強邊緣
  };
}

// 背景移除回應介面
export interface BackgroundRemoveResponse {
  success: boolean;                // 是否成功
  message: string;                 // 回應訊息
  data?: {                        // 成功時的資料
    processedImageUrl: string;    // 處理後的圖片 URL
    originalImageUrl: string;     // 原始圖片 URL
    processingTime: number;       // 處理時間（秒）
    quality: string;              // 使用的品質設定
    format: string;               // 輸出格式
    timestamp: string;            // 處理時間戳
  };
  error?: {                       // 錯誤時的資料
    code: string;                 // 錯誤代碼
    details: string;              // 錯誤詳情
  };
}

// 背景移除資料介面 (前端使用)
export interface BackgroundRemoveData {
  quality: 'high';
  format: 'PNG';
  keepShadows: boolean;
  enhanceEdges: boolean;
}

// 資料驗證函數
export const validateBackgroundRemoveData = (data: BackgroundRemoveData): boolean => {
  return (
    ['high'].includes(data.quality) && // 品質必須有效
    ['PNG'].includes(data.format) && // 格式必須有效
    typeof data.keepShadows === 'boolean' && // 保留陰影必須是布林值
    typeof data.enhanceEdges === 'boolean'   // 增強邊緣必須是布林值
  );
};

// 轉換前端資料格式為 API 請求格式
export const convertBackgroundRemoveDataToRequest = (
  removeData: BackgroundRemoveData, 
  imageId: string
): BackgroundRemoveRequest => {
  return {
    imageId: imageId,
    options: {
      quality: removeData.quality,
      format: removeData.format,
      keepShadows: removeData.keepShadows,
      enhanceEdges: removeData.enhanceEdges
    }
  };
};

// 背景移除 API 呼叫函數
export const removeBackground = async (
  removeData: BackgroundRemoveData, 
  imageId: string
): Promise<BackgroundRemoveResponse> => {
  try {
    // 驗證資料
    if (!validateBackgroundRemoveData(removeData)) {
      throw new Error('背景移除資料格式錯誤');
    }

    // 轉換資料格式
    const requestData = convertBackgroundRemoveDataToRequest(removeData, imageId);

    console.log('發送背景移除請求:', requestData);

    // 發送 API 請求
    const response = await fetch('/api/image/remove-background', {
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
    console.log('背景移除回應:', result);
    
    return result;
  } catch (error) {
    console.error('背景移除失敗:', error);
    throw error;
  }
};

// 錯誤處理函數
export const handleBackgroundRemoveError = (error: unknown): string => {
  let errorMessage = '背景移除失敗';
  
  // 檢查是否為 API 錯誤回應
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { error?: { code: string; details: string } } } };
    if (apiError.response?.data?.error) {
      const errorData = apiError.response.data.error;
      switch (errorData.code) {
        case 'IMAGE_NOT_FOUND':
          errorMessage = '圖片不存在';
          break;
        case 'IMAGE_TOO_LARGE':
          errorMessage = '圖片檔案過大';
          break;
        case 'UNSUPPORTED_FORMAT':
          errorMessage = '不支援的圖片格式';
          break;
        case 'PROCESSING_FAILED':
          errorMessage = 'AI 處理失敗，請重試';
          break;
        case 'QUOTA_EXCEEDED':
          errorMessage = '處理配額已用完';
          break;
        case 'INVALID_OPTIONS':
          errorMessage = '無效的處理選項';
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