import { NextRequest, NextResponse } from 'next/server';
import mockData from './mock-data.json';

// 尺寸調整請求介面
interface ResizeRequest {
  imageId: string;
  width: number;
  height: number;
  format: string;
  quality: number;
  presetName?: string;
  maintainAspectRatio?: boolean;
  targetSize?: {
    width: number;
    height: number;
  };
  resizeMode?: 'crop' | 'expand';
}

// 尺寸調整回應介面
interface ResizeResponse {
  success: boolean;
  message: string;
  data?: {
    resizedImageUrl: string;
    originalSize: {
      width: number;
      height: number;
    };
    targetSize: {
      width: number;
      height: number;
    };
    resizeMode: string;
    format: string;
    quality: number;
    timestamp: string;
    processingTime: number;
    // 新增：處理統計資訊
    processingStats: {
      processingTime: number;
      originalSize: string;
      targetSize: string;
      compressionRatio: number;
    };
  };
  error?: {
    code: string;
    details: string;
  };
}

// 驗證請求資料
function validateResizeRequest(data: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('請求資料必須是物件');
    return { isValid: false, errors };
  }

  const requestData = data as Record<string, unknown>;

  if (!requestData.imageId || typeof requestData.imageId !== 'string') {
    errors.push('imageId 是必需的且必須是字串');
  }

  if (!requestData.width || typeof requestData.width !== 'number' || requestData.width <= 0) {
    errors.push('width 是必需的且必須是大於 0 的數字');
  }

  if (!requestData.height || typeof requestData.height !== 'number' || requestData.height <= 0) {
    errors.push('height 是必需的且必須是大於 0 的數字');
  }

  if (!requestData.format || typeof requestData.format !== 'string') {
    errors.push('format 是必需的且必須是字串');
  }

  if (requestData.quality && (typeof requestData.quality !== 'number' || requestData.quality < 1 || requestData.quality > 100)) {
    errors.push('quality 必須是 1-100 之間的數字');
  }

  if (typeof requestData.width === 'number' && (requestData.width > 4000 || requestData.width < 10)) {
    errors.push('寬度必須在 10-4000 像素之間');
  }

  if (typeof requestData.height === 'number' && (requestData.height > 4000 || requestData.height < 10)) {
    errors.push('高度必須在 10-4000 像素之間');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// 模擬處理時間
function simulateProcessingTime(width: number, height: number): number {
  const baseTime = 1000; // 基礎處理時間 1 秒
  const sizeFactor = (width * height) / (1920 * 1080); // 相對於 1080p 的倍數
  const randomFactor = 0.5 + Math.random() * 1.0; // 0.5-1.5 的隨機倍數
  
  return Math.round(baseTime * sizeFactor * randomFactor);
}

// 模擬錯誤率
function shouldSimulateError(): boolean {
  return Math.random() < 0.05; // 5% 的錯誤率
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('收到尺寸調整請求:', body);

    // 驗證請求資料
    const validation = validateResizeRequest(body);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        message: '請求資料驗證失敗',
        error: {
          code: 'VALIDATION_ERROR',
          details: validation.errors.join(', ')
        }
      } as ResizeResponse, { status: 400 });
    }

    const requestData = body as ResizeRequest;

    // 模擬處理時間
    const processingTime = simulateProcessingTime(requestData.width, requestData.height);
    
    // 模擬錯誤
    if (shouldSimulateError()) {
      return NextResponse.json({
        success: false,
        message: '圖片處理失敗，請稍後再試',
        error: {
          code: 'PROCESSING_ERROR',
          details: '模擬的處理錯誤'
        }
      } as ResizeResponse, { status: 500 });
    }

    // 模擬處理延遲
    await new Promise(resolve => setTimeout(resolve, Math.min(processingTime, 3000)));

    // 從 mock 資料中隨機選擇一個回應
    const mockResponse = mockData.scenarios.success[Math.floor(Math.random() * mockData.scenarios.success.length)];

    // 構建回應資料
    const responseData: ResizeResponse = {
      success: true,
      message: '圖片尺寸調整成功',
      data: {
        resizedImageUrl: mockResponse.data.resizedImageUrl,
        originalSize: {
          width: 1920,
          height: 1080
        },
        targetSize: {
          width: requestData.width,
          height: requestData.height
        },
        resizeMode: requestData.resizeMode || 'crop',
        format: requestData.format,
        quality: requestData.quality || 85,
        timestamp: new Date().toISOString(),
        processingTime: Math.round(processingTime / 1000),
        processingStats: {
          processingTime: Math.round(processingTime / 1000),
          originalSize: '1920x1080',
          targetSize: `${requestData.width}x${requestData.height}`,
          compressionRatio: Math.round((1 - (requestData.width * requestData.height) / (1920 * 1080)) * 100)
        }
      }
    };

    console.log('尺寸調整成功:', responseData);
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('尺寸調整 API 錯誤:', error);
    return NextResponse.json({
      success: false,
      message: '伺服器內部錯誤',
      error: {
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : '未知錯誤'
      }
    } as ResizeResponse, { status: 500 });
  }
}



