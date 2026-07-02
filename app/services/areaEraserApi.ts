// 區域擦除 API 服務

// 區域擦除請求介面
export interface AreaEraseRequest {
  imageId: string;                 // 圖片 ID
  areas: Array<{                   // 擦除區域列表
    x: number;                     // X 座標
    y: number;                     // Y 座標
    width: number;                 // 寬度
    height: number;                // 高度
  }>;
  options?: {                      // 可選設定
    brushSize: number;             // 筆刷大小
    feathering: number;            // 羽化程度 (0-100)
    blendMode: 'normal' | 'multiply' | 'screen'; // 混合模式
    tolerance: number;             // 容差 (0-255)
  };
}

// 區域擦除回應介面
export interface AreaEraseResponse {
  success: boolean;                // 是否成功
  message: string;                 // 回應訊息
  data?: {                        // 成功時的資料
    processedImageUrl: string;    // 處理後的圖片 URL
    originalImageUrl: string;     // 原始圖片 URL
    erasedAreas: Array<{          // 實際擦除的區域
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    processingTime: number;       // 處理時間（秒）
    brushSize: number;            // 使用的筆刷大小
    timestamp: string;            // 處理時間戳
  };
  error?: {                       // 錯誤時的資料
    code: string;                 // 錯誤代碼
    details: string;              // 錯誤詳情
  };
}

// 區域擦除資料介面 (前端使用)
export interface AreaEraseData {
  areas: Array<{ x: number; y: number; width: number; height: number }>;
  brushSize: number;
  feathering: number;
  blendMode: 'normal' | 'multiply' | 'screen';
  tolerance: number;
}

// 資料驗證函數
export const validateAreaEraseData = (data: AreaEraseData): boolean => {
  console.log('驗證資料:', JSON.stringify(data, null, 2));
  
  // 檢查基本結構
  if (!data.areas || !Array.isArray(data.areas)) {
    console.error('驗證失敗: areas 不是陣列');
    return false;
  }
  
  if (data.areas.length === 0) {
    console.error('驗證失敗: areas 陣列為空');
    return false;
  }
  
  // 檢查每個區域
  const areaValidation = data.areas.every((area, index) => {
    if (area.x < 0 || area.y < 0) {
      console.error(`驗證失敗: 區域 ${index} 座標為負數`, area);
      return false;
    }
    if (area.width <= 0 || area.height <= 0) {
      console.error(`驗證失敗: 區域 ${index} 寬高不正確`, area);
      return false;
    }
    return true;
  });
  
  if (!areaValidation) {
    return false;
  }
  
  // 檢查其他參數
  if (data.brushSize < 1 || data.brushSize > 100) {
    console.error('驗證失敗: brushSize 超出範圍', data.brushSize);
    return false;
  }
  
  if (data.feathering < 0 || data.feathering > 100) {
    console.error('驗證失敗: feathering 超出範圍', data.feathering);
    return false;
  }
  
  if (!['normal', 'multiply', 'screen'].includes(data.blendMode)) {
    console.error('驗證失敗: blendMode 無效', data.blendMode);
    return false;
  }
  
  if (data.tolerance < 0 || data.tolerance > 255) {
    console.error('驗證失敗: tolerance 超出範圍', data.tolerance);
    return false;
  }
  
  console.log('驗證通過');
  return true;
};

// 轉換前端資料格式為 API 請求格式
export const convertAreaEraseDataToRequest = (
  eraseData: AreaEraseData, 
  imageId: string
): AreaEraseRequest => {
  return {
    imageId: imageId,
    areas: eraseData.areas,
    options: {
      brushSize: eraseData.brushSize,
      feathering: eraseData.feathering,
      blendMode: eraseData.blendMode,
      tolerance: eraseData.tolerance
    }
  };
};

// 區域擦除 API 呼叫函數
export const eraseAreas = async (
  eraseData: AreaEraseData, 
  imageId: string
): Promise<AreaEraseResponse> => {
  try {
    // 驗證資料
    if (!validateAreaEraseData(eraseData)) {
      throw new Error('區域擦除資料格式錯誤');
    }

    // 轉換資料格式
    const requestData = convertAreaEraseDataToRequest(eraseData, imageId);

    console.log('發送區域擦除請求:', requestData);

    // 模擬 API 處理時間
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 模擬成功回應
    const mockResponse: AreaEraseResponse = {
      success: true,
      message: '區域擦除處理成功（模擬）',
      data: {
        processedImageUrl: `/api/placeholder/processed-${imageId}.jpg`,
        originalImageUrl: `/api/placeholder/original-${imageId}.jpg`,
        erasedAreas: eraseData.areas,
        processingTime: 1.0,
        brushSize: eraseData.brushSize,
        timestamp: new Date().toISOString()
      }
    };

    console.log('模擬區域擦除回應:', mockResponse);
    
    return mockResponse;
    
    /* 實際 API 請求（暫時註解）
    const response = await fetch('/api/image/erase-areas', {
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
    console.log('區域擦除回應:', result);
    
    return result;
    */
  } catch (error) {
    console.error('區域擦除失敗:', error);
    
    return {
      success: false,
      message: handleAreaEraseError(error),
      error: {
        code: 'ERASE_FAILED',
        details: error instanceof Error ? error.message : '未知錯誤'
      }
    };
  }
};

// 錯誤處理函數
export const handleAreaEraseError = (error: unknown): string => {
  if (error instanceof Error) {
    // 根據錯誤類型返回對應的中文錯誤訊息
    if (error.message.includes('資料格式錯誤')) {
      return '區域擦除資料格式不正確，請檢查輸入參數';
    }
    if (error.message.includes('HTTP error')) {
      return '網路連線錯誤，請檢查網路連線後重試';
    }
    if (error.message.includes('timeout')) {
      return '處理超時，請稍後重試';
    }
    return `區域擦除失敗: ${error.message}`;
  }
  
  return '區域擦除時發生未知錯誤';
};

// 預設區域擦除設定
export const defaultAreaEraseData: AreaEraseData = {
  areas: [],
  brushSize: 20,
  feathering: 5,
  blendMode: 'normal',
  tolerance: 30
};

// 批次區域擦除 (支援多個區域同時處理)
export const batchEraseAreas = async (
  eraseDataList: Array<{ data: AreaEraseData; imageId: string }>
): Promise<Array<AreaEraseResponse>> => {
  const promises = eraseDataList.map(({ data, imageId }) => 
    eraseAreas(data, imageId)
  );
  
  return Promise.all(promises);
};

// 預覽區域擦除效果 (輕量級預覽)
export const previewAreaErase = async (
  eraseData: AreaEraseData, 
  imageId: string
): Promise<AreaEraseResponse> => {
  try {
    const requestData = convertAreaEraseDataToRequest(eraseData, imageId);
    
    // 添加預覽標記
    const previewRequest = {
      ...requestData,
      preview: true
    };

    console.log('發送區域擦除預覽請求:', previewRequest);

    const response = await fetch('/api/image/erase-areas/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(previewRequest)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('區域擦除預覽回應:', result);
    
    return result;
  } catch (error) {
    console.error('區域擦除預覽失敗:', error);
    
    return {
      success: false,
      message: handleAreaEraseError(error),
      error: {
        code: 'PREVIEW_FAILED',
        details: error instanceof Error ? error.message : '未知錯誤'
      }
    };
  }
}; 