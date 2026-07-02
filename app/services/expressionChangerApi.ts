// 表情姿勢調整 API 服務

// 表情姿勢調整請求介面
export interface ExpressionChangeRequest {
  imageId: string;                 // 圖片 ID
  expression: {                    // 表情設定
    type: 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral'; // 表情類型
    intensity: number;             // 強度 (0-100)
  };
  pose: {                          // 姿勢設定
    type: 'standing' | 'sitting' | 'walking' | 'running' | 'dancing' | 'pointing' | 'waving' | 'neutral'; // 姿勢類型
    intensity: number;             // 強度 (0-100)
  };
  options?: {                      // 可選設定
    preserveOriginal: boolean;     // 保持原始特徵
    blendMode: 'normal' | 'overlay' | 'soft-light'; // 混合模式
    smoothing: number;             // 平滑度 (0-100)
  };
}

// 表情姿勢調整回應介面
export interface ExpressionChangeResponse {
  success: boolean;                // 是否成功
  data?: {                        // 成功時的資料
    processedImageUrl: string;     // 處理後的圖片 URL
    expressionType: string;        // 表情類型
    poseType: string;              // 姿勢類型
    processingTime: number;        // 處理時間 (毫秒)
  };
  error?: {                       // 錯誤資訊
    code: string;                  // 錯誤代碼
    message: string;               // 錯誤訊息
    details?: string;              // 詳細資訊
  };
}

// 表情姿勢資料介面 (前端使用)
export interface ExpressionData {
  type: 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral'; // 表情類型
  pose: 'standing' | 'sitting' | 'walking' | 'running' | 'dancing' | 'pointing' | 'waving' | 'neutral'; // 姿勢類型
  intensity: number;               // 強度 (0-100)
  preserveOriginal?: boolean;      // 保持原始特徵
  smoothing?: number;              // 平滑度 (0-100)
}

// 資料驗證函數
export const validateExpressionData = (data: ExpressionData): boolean => {
  return (
    ['happy', 'sad', 'angry', 'surprised', 'neutral'].includes(data.type) &&
    ['standing', 'sitting', 'walking', 'running', 'dancing', 'pointing', 'waving', 'neutral'].includes(data.pose) &&
    data.intensity >= 0 &&
    data.intensity <= 100 &&
    (data.preserveOriginal === undefined || typeof data.preserveOriginal === 'boolean') &&
    (data.smoothing === undefined || (data.smoothing >= 0 && data.smoothing <= 100))
  );
};

// 轉換前端資料格式為 API 請求格式
export const convertExpressionDataToRequest = (
  expressionData: ExpressionData, 
  imageId: string
): ExpressionChangeRequest => {
  return {
    imageId: imageId,
    expression: {
      type: expressionData.type,
      intensity: expressionData.intensity
    },
    pose: {
      type: expressionData.pose,
      intensity: expressionData.intensity
    },
    options: {
      preserveOriginal: expressionData.preserveOriginal || false,
      blendMode: 'normal',
      smoothing: expressionData.smoothing || 50
    }
  };
};

// 表情姿勢調整 API 呼叫函數
export const changeExpression = async (
  expressionData: ExpressionData, 
  imageId: string
): Promise<ExpressionChangeResponse> => {
  try {
    // 驗證資料
    if (!validateExpressionData(expressionData)) {
      throw new Error('表情姿勢資料格式錯誤');
    }

    // 轉換資料格式
    const requestData = convertExpressionDataToRequest(expressionData, imageId);

    console.log('發送表情姿勢調整請求:', requestData);

    // 發送 API 請求
    const response = await fetch('/api/image/expression', {
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
    console.log('表情姿勢調整回應:', result);
    
    return result;
  } catch (error) {
    console.error('表情姿勢調整失敗:', error);
    throw error;
  }
};

// 錯誤處理函數
export const handleExpressionError = (error: unknown): string => {
  let errorMessage = '表情姿勢調整失敗';
  
  // 檢查是否為 API 錯誤回應
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { error?: { code: string; details: string } } } };
    if (apiError.response?.data?.error) {
      const errorData = apiError.response.data.error;
      switch (errorData.code) {
        case 'INVALID_EXPRESSION':
          errorMessage = '無效的表情設定';
          break;
        case 'INVALID_POSE':
          errorMessage = '無效的姿勢設定';
          break;
        case 'IMAGE_NOT_FOUND':
          errorMessage = '圖片不存在';
          break;
        case 'INTENSITY_OUT_OF_RANGE':
          errorMessage = '強度值超出範圍';
          break;
        case 'AI_SERVICE_UNAVAILABLE':
          errorMessage = 'AI 服務暫時不可用';
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
