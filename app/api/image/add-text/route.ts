import { NextRequest, NextResponse } from 'next/server';

// 加文字請求介面
interface AddTextRequest {
  text: string;
  font: string;
  align: 'left' | 'center' | 'right';
  position: {
    x: number;
    y: number;
  };
  imageId: string;
  style: {
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
  };
}

// 加文字回應介面
interface AddTextResponse {
  success: boolean;
  message: string;
  data?: {
    textId: string;
    imageUrl: string;
    textPosition: {
      x: number;
      y: number;
    };
    timestamp: string;
    // 新增：文字樣式資訊
    textStyle: {
      font: string;
      fontSize: number;
      color: string;
      bold: boolean;
      italic: boolean;
      underline: boolean;
      align: string;
    };
    // 新增：處理統計資訊
    processingStats: {
      processingTime: number;
      textLength: number;
      imageSize: string;
    };
  };
  error?: {
    code: string;
    details: string;
  };
}

// 驗證請求資料
const validateRequest = (data: AddTextRequest): { isValid: boolean; error?: string } => {
  // 檢查必要欄位
  if (!data.text || data.text.trim().length === 0) {
    return { isValid: false, error: '文字內容不能為空' };
  }

  if (data.text.length > 200) {
    return { isValid: false, error: '文字長度不能超過200個字符' };
  }

  if (!data.font) {
    return { isValid: false, error: '字體不能為空' };
  }

  if (!['left', 'center', 'right'].includes(data.align)) {
    return { isValid: false, error: '對齊方式無效' };
  }

  if (data.position.x < 0 || data.position.x > 100 || data.position.y < 0 || data.position.y > 100) {
    return { isValid: false, error: '位置座標超出範圍' };
  }

  if (data.style.fontSize < 12 || data.style.fontSize > 72) {
    return { isValid: false, error: '字體大小超出範圍' };
  }

  if (!data.imageId) {
    return { isValid: false, error: '圖片ID不能為空' };
  }

  return { isValid: true };
};

// 生成假資料回應
const generateMockResponse = (requestData: AddTextRequest): AddTextResponse => {
  // 模擬處理時間
  const processingTime = Math.floor(Math.random() * 2000) + 500; // 500-2500ms
  
  // 模擬圖片尺寸
  const imageSizes = ['1920x1080', '1280x720', '800x600', '1024x768'];
  const randomImageSize = imageSizes[Math.floor(Math.random() * imageSizes.length)];
  
  // 生成模擬的處理後圖片 URL
  const mockImageUrl = `https://api.psf.com/processed/${requestData.imageId}_text_${Date.now()}.jpg`;
  
  // 生成文字 ID
  const textId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    success: true,
    message: '文字添加成功',
    data: {
      textId,
      imageUrl: mockImageUrl,
      textPosition: {
        x: requestData.position.x,
        y: requestData.position.y
      },
      timestamp: new Date().toISOString(),
      textStyle: {
        font: requestData.font,
        fontSize: requestData.style.fontSize,
        color: requestData.style.color,
        bold: requestData.style.bold,
        italic: requestData.style.italic,
        underline: requestData.style.underline,
        align: requestData.align
      },
      processingStats: {
        processingTime,
        textLength: requestData.text.length,
        imageSize: randomImageSize
      }
    }
  };
};

// 模擬錯誤回應
const generateErrorResponse = (errorCode: string, errorDetails: string): AddTextResponse => {
  return {
    success: false,
    message: '處理失敗',
    error: {
      code: errorCode,
      details: errorDetails
    }
  };
};

export async function POST(request: NextRequest) {
  try {
    console.log('收到加文字請求');

    // 解析請求資料
    const requestData: AddTextRequest = await request.json();
    console.log('請求資料:', JSON.stringify(requestData, null, 2));

    // 驗證請求資料
    const validation = validateRequest(requestData);
    if (!validation.isValid) {
      const errorResponse = generateErrorResponse('VALIDATION_ERROR', validation.error || '未知驗證錯誤');
      
      console.log('驗證失敗:', JSON.stringify(errorResponse, null, 2));
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // 模擬處理延遲
    console.log('開始模擬圖片處理...');
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 1000) + 500)); // 500-1500ms
    
    // 模擬偶爾的處理失敗（5% 機率）
    if (Math.random() < 0.05) {
      const errorResponse = generateErrorResponse('PROCESSING_ERROR', '圖片處理過程中發生錯誤，請稍後重試');
      console.log('模擬處理失敗:', JSON.stringify(errorResponse, null, 2));
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // 生成假資料回應
    const responseData = generateMockResponse(requestData);
    console.log('處理完成，回應資料:', JSON.stringify(responseData, null, 2));

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('處理加文字請求時發生錯誤:', error);

    const errorResponse = generateErrorResponse(
      'INTERNAL_ERROR', 
      error instanceof Error ? error.message : '未知錯誤'
    );

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// 新增：GET 方法用於獲取文字處理狀態
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const textId = searchParams.get('textId');
    
    if (!textId) {
      return NextResponse.json({
        success: false,
        message: '缺少文字ID參數',
        error: {
          code: 'MISSING_PARAMETER',
          details: 'textId 參數是必需的'
        }
      }, { status: 400 });
    }

    // 模擬狀態查詢
    const mockStatus = {
      success: true,
      message: '查詢成功',
      data: {
        textId,
        status: 'completed', // 或 'processing', 'failed'
        progress: 100,
        estimatedTime: 0,
        timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(mockStatus);

  } catch (error) {
    console.error('查詢文字處理狀態時發生錯誤:', error);
    
    return NextResponse.json({
      success: false,
      message: '查詢失敗',
      error: {
        code: 'QUERY_ERROR',
        details: error instanceof Error ? error.message : '未知錯誤'
      }
    }, { status: 500 });
  }
} 