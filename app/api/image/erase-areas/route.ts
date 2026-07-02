import { NextRequest, NextResponse } from 'next/server';

// 區域擦除請求介面
interface AreaEraseRequest {
  imageId: string;
  areas: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  options?: {
    brushSize: number;
    feathering: number;
    blendMode: 'normal' | 'multiply' | 'screen';
    tolerance: number;
  };
}

// 區域擦除回應介面
interface AreaEraseResponse {
  success: boolean;
  message: string;
  data?: {
    processedImageUrl: string;
    originalImageUrl: string;
    erasedAreas: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    processingTime: number;
    brushSize: number;
    timestamp: string;
  };
  error?: {
    code: string;
    details: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<AreaEraseResponse>> {
  try {
    const body: AreaEraseRequest = await request.json();
    
    console.log('收到區域擦除請求:', body);
    
    // 驗證請求資料
    if (!body.imageId) {
      return NextResponse.json({
        success: false,
        message: '缺少圖片ID',
        error: {
          code: 'MISSING_IMAGE_ID',
          details: 'imageId 是必需的'
        }
      }, { status: 400 });
    }
    
    if (!body.areas || !Array.isArray(body.areas) || body.areas.length === 0) {
      return NextResponse.json({
        success: false,
        message: '缺少擦除區域',
        error: {
          code: 'MISSING_AREAS',
          details: 'areas 陣列不能為空'
        }
      }, { status: 400 });
    }
    
    // 驗證每個區域
    for (let i = 0; i < body.areas.length; i++) {
      const area = body.areas[i];
      if (area.x < 0 || area.y < 0 || area.width <= 0 || area.height <= 0) {
        return NextResponse.json({
          success: false,
          message: `區域 ${i} 座標無效`,
          error: {
            code: 'INVALID_AREA_COORDINATES',
            details: `區域 ${i} 的座標或尺寸無效`
          }
        }, { status: 400 });
      }
    }
    
    // 模擬處理時間
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 1000)); // 模擬 1 秒處理時間
    const processingTime = (Date.now() - startTime) / 1000;
    
    // 這裡應該實現實際的圖片處理邏輯
    // 目前只是模擬成功回應
    const response: AreaEraseResponse = {
      success: true,
      message: '區域擦除處理成功',
      data: {
        processedImageUrl: `/api/placeholder/processed-${body.imageId}.jpg`,
        originalImageUrl: `/api/placeholder/original-${body.imageId}.jpg`,
        erasedAreas: body.areas,
        processingTime: processingTime,
        brushSize: body.options?.brushSize || 20,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('區域擦除處理完成:', response);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('區域擦除處理失敗:', error);
    
    return NextResponse.json({
      success: false,
      message: '區域擦除處理失敗',
      error: {
        code: 'PROCESSING_FAILED',
        details: error instanceof Error ? error.message : '未知錯誤'
      }
    }, { status: 500 });
  }
} 