// 圖片編輯器 API 服務

// 加文字請求介面
export interface AddTextRequest {
  text: string;                    // 文字內容
  font: string;                    // 字體
  align: 'left' | 'center' | 'right'; // 對齊方式
  position: {                      // 位置
    x: number;                     // X 座標 (百分比)
    y: number;                     // Y 座標 (百分比)
  };
  imageId: string;                 // 圖片 ID
  style: {                         // 樣式設定
    fontSize: number;              // 字體大小
    color: string;                 // 顏色
    bold: boolean;                 // 粗體
    italic: boolean;               // 斜體
    underline: boolean;            // 底線
  };
}

// 加文字回應介面
export interface AddTextResponse {
  success: boolean;                // 是否成功
  message: string;                 // 回應訊息
  data?: {                        // 成功時的資料
    textId: string;               // 文字 ID
    imageUrl: string;             // 處理後的圖片 URL
    textPosition: {               // 實際文字位置
      x: number;
      y: number;
    };
    timestamp: string;            // 處理時間戳
  };
  error?: {                       // 錯誤時的資料
    code: string;                 // 錯誤代碼
    details: string;              // 錯誤詳情
  };
}

// 文字資料介面 (前端使用)
export interface TextData {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

// 資料驗證函數
export const validateTextData = (data: TextData): boolean => {
  return (
    data.text.length > 0 &&           // 文字不能為空
    data.text.length <= 200 &&        // 文字長度限制
    data.fontSize >= 12 &&            // 字體大小最小限制
    data.fontSize <= 72 &&            // 字體大小最大限制
    data.x >= 0 && data.x <= 100 &&   // X 座標範圍
    data.y >= 0 && data.y <= 100      // Y 座標範圍
  );
};

// 轉換前端資料格式為 API 請求格式
export const convertTextDataToRequest = (textData: TextData, imageId: string): AddTextRequest => {
  return {
    text: textData.text,
    font: textData.fontFamily,
    align: textData.align,
    position: {
      x: textData.x,
      y: textData.y
    },
    imageId: imageId,
    style: {
      fontSize: textData.fontSize,
      color: textData.color,
      bold: textData.bold,
      italic: textData.italic,
      underline: textData.underline
    }
  };
};

// 加文字 API 呼叫函數
export const addTextToImage = async (textData: TextData, imageId: string): Promise<AddTextResponse> => {
  try {
    // 驗證資料
    if (!validateTextData(textData)) {
      throw new Error('文字資料格式錯誤');
    }

    // 轉換資料格式
    const requestData = convertTextDataToRequest(textData, imageId);

    console.log('發送加文字請求:', requestData);

    // 發送 API 請求
    const response = await fetch('/api/image/add-text', {
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
    console.log('加文字回應:', result);
    
    return result;
  } catch (error) {
    console.error('添加文字失敗:', error);
    throw error;
  }
};

// 錯誤處理函數
export const handleTextError = (error: unknown): string => {
  let errorMessage = '文字添加失敗';
  
  // 檢查是否為 API 錯誤回應
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { error?: { code: string; details: string } } } };
    if (apiError.response?.data?.error) {
      const errorData = apiError.response.data.error;
      switch (errorData.code) {
        case 'INVALID_TEXT_LENGTH':
          errorMessage = '文字長度超過限制';
          break;
        case 'INVALID_POSITION':
          errorMessage = '文字位置無效';
          break;
        case 'IMAGE_NOT_FOUND':
          errorMessage = '圖片不存在';
          break;
        case 'FONT_NOT_SUPPORTED':
          errorMessage = '不支援的字體';
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