import { NextRequest, NextResponse } from 'next/server';

// 表情姿勢調整請求介面
interface ExpressionChangeRequest {
  imageId: string;
  expression: {
    type: 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral';
    intensity: number;
  };
  pose: {
    type: 'standing' | 'sitting' | 'walking' | 'running' | 'dancing' | 'pointing' | 'waving' | 'neutral';
    intensity: number;
  };
  options?: {
    preserveOriginal: boolean;
    blendMode: 'normal' | 'overlay' | 'soft-light';
    smoothing: number;
  };
}

// 表情姿勢調整回應介面
interface ExpressionChangeResponse {
  success: boolean;
  data?: {
    processedImageUrl: string;
    expressionType: string;
    poseType: string;
    processingTime: number;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

// 資料驗證函數
const validateExpressionRequest = (data: unknown): data is ExpressionChangeRequest => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  
  return (
    typeof obj.imageId === 'string' &&
    obj.imageId.length > 0 &&
    typeof obj.expression === 'object' &&
    obj.expression !== null &&
    typeof (obj.expression as Record<string, unknown>).type === 'string' &&
    ['happy', 'sad', 'angry', 'surprised', 'neutral'].includes((obj.expression as Record<string, unknown>).type as string) &&
    typeof (obj.expression as Record<string, unknown>).intensity === 'number' &&
    Number((obj.expression as Record<string, unknown>).intensity) >= 0 &&
    Number((obj.expression as Record<string, unknown>).intensity) <= 100 &&
    typeof obj.pose === 'object' &&
    obj.pose !== null &&
    typeof (obj.pose as Record<string, unknown>).type === 'string' &&
    ['standing', 'sitting', 'walking', 'running', 'dancing', 'pointing', 'waving', 'neutral'].includes((obj.pose as Record<string, unknown>).type as string) &&
    typeof (obj.pose as Record<string, unknown>).intensity === 'number' &&
    Number((obj.pose as Record<string, unknown>).intensity) >= 0 &&
    Number((obj.pose as Record<string, unknown>).intensity) <= 100
  );
};

// 模擬 AI 處理延遲
const simulateProcessing = (): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.random() * 2000 + 1000); // 1-3秒隨機延遲
  });
};

// 生成模擬的處理後圖片 URL
const generateMockProcessedImageUrl = (imageId: string, expressionType: string, poseType: string): string => {
  const timestamp = Date.now();
  return `https://picsum.photos/800/600?random=${timestamp}&expression=${expressionType}&pose=${poseType}`;
};

export async function POST(request: NextRequest): Promise<NextResponse<ExpressionChangeResponse>> {
  try {
    const body = await request.json();
    
    // 驗證請求資料
    if (!validateExpressionRequest(body)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '請求資料格式錯誤',
          details: '請檢查 imageId、expression 和 pose 欄位是否正確'
        }
      }, { status: 400 });
    }

    const { imageId, expression, pose, options } = body;

    console.log('收到表情姿勢調整請求:', { imageId, expression, pose, options });

    // 模擬處理過程
    await simulateProcessing();

    // 模擬 10% 的失敗率
    if (Math.random() < 0.1) {
      const errorCodes = [
        'INVALID_EXPRESSION',
        'INVALID_POSE',
        'IMAGE_NOT_FOUND',
        'INTENSITY_OUT_OF_RANGE',
        'AI_SERVICE_UNAVAILABLE'
      ];
      const randomErrorCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
      
      return NextResponse.json({
        success: false,
        error: {
          code: randomErrorCode,
          message: '表情姿勢調整失敗',
          details: `模擬錯誤: ${randomErrorCode}`
        }
      }, { status: 500 });
    }

    // 生成成功回應
    const processedImageUrl = generateMockProcessedImageUrl(imageId, expression.type, pose.type);
    const processingTime = Math.floor(Math.random() * 2000 + 1000);

    const response: ExpressionChangeResponse = {
      success: true,
      data: {
        processedImageUrl,
        expressionType: expression.type,
        poseType: pose.type,
        processingTime
      }
    };

    console.log('表情姿勢調整成功:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('表情姿勢調整 API 錯誤:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '伺服器內部錯誤',
        details: error instanceof Error ? error.message : '未知錯誤'
      }
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: '表情姿勢調整 API',
    version: '1.0.0',
    endpoints: {
      POST: '/api/image/expression - 調整表情和姿勢'
    }
  });
}
