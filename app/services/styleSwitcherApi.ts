// 風格切換 API 服務

// 風格切換請求介面
export interface StyleSwitchRequest {
  imageId: string;                 // 圖片 ID
  styleId: string;                 // 風格 ID
  options?: {                      // 可選設定
    intensity: number;             // 強度 (0-100)
    preserveColors: boolean;       // 保持原色
    blendMode: 'normal' | 'overlay' | 'soft-light'; // 混合模式
  };
}

// 風格切換回應介面
export interface StyleSwitchResponse {
  success: boolean;                // 是否成功
  data?: {                        // 成功時的資料
    processedImageUrl: string;     // 處理後的圖片 URL
    styleName: string;             // 風格名稱
    processingTime: number;        // 處理時間 (毫秒)
  };
  error?: {                       // 錯誤資訊
    code: string;                  // 錯誤代碼
    message: string;               // 錯誤訊息
    details?: string;              // 詳細資訊
  };
}

// 工作流程介面
export interface Workflow {
  name: string;                   // 工作流程名稱
  id?: string;                    // 工作流程 ID
  description?: string;           // 工作流程描述
  [key: string]: unknown;         // 其他動態屬性
}

// 風格分類介面
export interface StyleCategory {
  id: string;                     // 分類 ID
  name: {                         // 分類名稱（多語言）
    [key: string]: string;        // 語言代碼 -> 名稱
  };
  createdAt?: string;             // 創建時間
  updatedAt?: string;             // 更新時間
}

// 風格介面
export interface Style {
  id: string;                     // 風格 ID
  name: string;                   // 風格名稱
  title: string;                  // 風格標題
  category: string;               // 分類
  description: string;            // 描述
  previewUrl: string;             // 預覽圖片 URL
  cover?: string;                 // 封面圖片
  complexity: 'low' | 'medium' | 'high'; // 複雜度
  artist?: string;                // 藝術家名稱
  tags: string[];                 // 標籤
  popularity: number;             // 熱門度
  createdAt: string;              // 創建時間
  updatedAt?: string;             // 更新時間
  reference?: unknown;            // 參考資料
  workflow?: string | Workflow;   // 工作流程數據
  styleCategories?: string | StyleCategory[]; // 風格分類
}

// 風格列表回應介面
export interface StyleListResponse {
  success: boolean;               // 是否成功
  data?: {                       // 成功時的資料
    styles: Style[];              // 風格列表
    total: number;                // 總數量
    categories: string[];         // 分類列表
  };
  error?: {                      // 錯誤資訊
    code: string;                 // 錯誤代碼
    message: string;              // 錯誤訊息
  };
}

// 風格預覽請求介面
export interface StylePreviewRequest {
  imageId: string;                // 圖片 ID
  styleId: string;                // 風格 ID
  options?: {                     // 可選設定
    intensity: number;            // 強度 (0-100)
    size: 'small' | 'medium' | 'large'; // 預覽尺寸
  };
}

// 風格預覽回應介面
export interface StylePreviewResponse {
  success: boolean;               // 是否成功
  data?: {                       // 成功時的資料
    previewUrl: string;           // 預覽圖片 URL
    processingTime: number;       // 處理時間 (毫秒)
  };
  error?: {                      // 錯誤資訊
    code: string;                 // 錯誤代碼
    message: string;              // 錯誤訊息
  };
}

// 資料驗證函數
export const validateStyleSwitchData = (data: StyleSwitchRequest): boolean => {
  return (
    typeof data.imageId === 'string' &&
    data.imageId.length > 0 &&
    typeof data.styleId === 'string' &&
    data.styleId.length > 0 &&
    (data.options === undefined || (
      typeof data.options.intensity === 'number' &&
      data.options.intensity >= 0 &&
      data.options.intensity <= 100 &&
      typeof data.options.preserveColors === 'boolean' &&
      ['normal', 'overlay', 'soft-light'].includes(data.options.blendMode)
    ))
  );
};

// 轉換前端資料格式為 API 請求格式
export const convertStyleSwitchDataToRequest = (
  styleData: { styleId: string; intensity?: number; preserveColors?: boolean },
  imageId: string
): StyleSwitchRequest => {
  return {
    imageId: imageId,
    styleId: styleData.styleId,
    options: {
      intensity: styleData.intensity || 80,
      preserveColors: styleData.preserveColors || false,
      blendMode: 'normal'
    }
  };
};

// 風格切換 API 呼叫函數
export const applyStyleSwitch = async (
  styleData: { styleId: string; intensity?: number; preserveColors?: boolean },
  imageId: string
): Promise<StyleSwitchResponse> => {
  try {
    // 驗證資料
    const requestData = convertStyleSwitchDataToRequest(styleData, imageId);
    if (!validateStyleSwitchData(requestData)) {
      throw new Error('風格切換資料格式錯誤');
    }

    console.log('發送風格切換請求:', requestData);

    // 發送 API 請求
    const response = await fetch('/api/image/style-transfer', {
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
    console.log('風格切換回應:', result);
    
    return result;
  } catch (error) {
    console.error('風格切換失敗:', error);
    throw error;
  }
};

// 獲取風格列表 API 呼叫函數
export const getStyleList = async (): Promise<StyleListResponse> => {
  try {
    console.log('發送風格列表請求');

    const response = await fetch('/api/image/style-transfer/styles', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('風格列表回應:', result);
    
    return result;
  } catch (error) {
    console.error('獲取風格列表失敗:', error);
    throw error;
  }
};

// 獲取風格預覽 API 呼叫函數
export const getStylePreview = async (
  imageId: string,
  styleId: string,
  options?: { intensity?: number; size?: 'small' | 'medium' | 'large' }
): Promise<StylePreviewResponse> => {
  try {
    const params = new URLSearchParams({
      imageId,
      styleId,
      ...(options?.intensity && { intensity: options.intensity.toString() }),
      ...(options?.size && { size: options.size })
    });

    console.log('發送風格預覽請求:', { imageId, styleId, options });

    const response = await fetch(`/api/image/style-transfer/preview?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('風格預覽回應:', result);
    
    return result;
  } catch (error) {
    console.error('獲取風格預覽失敗:', error);
    throw error;
  }
};

// 錯誤處理函數
export const handleStyleSwitchError = (error: unknown): string => {
  let errorMessage = '風格切換失敗';
  
  // 檢查是否為 API 錯誤回應
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { error?: { code: string; details: string } } } };
    if (apiError.response?.data?.error) {
      const errorData = apiError.response.data.error;
      switch (errorData.code) {
        case 'INVALID_STYLE':
          errorMessage = '無效的風格設定';
          break;
        case 'IMAGE_NOT_FOUND':
          errorMessage = '圖片不存在';
          break;
        case 'STYLE_NOT_FOUND':
          errorMessage = '風格不存在';
          break;
        case 'PROCESSING_FAILED':
          errorMessage = '風格處理失敗';
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
