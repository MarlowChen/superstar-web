import { NextRequest, NextResponse } from "next/server";

// 風格切換請求介面
interface StyleTransferRequest {
  imageId: string;
  styleId: string;
  intensity: number; // 1-100，風格強度
  options?: {
    preserveOriginalColors?: boolean;
    enhanceDetails?: boolean;
    blendMode?: "normal" | "multiply" | "overlay" | "soft_light";
    outputFormat?: "JPEG" | "PNG";
    quality?: number; // 1-100
  };
}

// 風格切換回應介面
interface StyleTransferResponse {
  success: boolean;
  message: string;
  data?: {
    processedImageUrl: string;
    originalImageUrl: string;
    appliedStyle: {
      id: string;
      name: string;
      category: string;
      artist?: string;
      intensity: number;
    };
    processingStats: {
      processingTime: number;
      aiModelUsed: string;
      styleComplexity: "low" | "medium" | "high";
      qualityScore: number;
      memoryUsed: string;
    };
    previewUrls?: {
      thumbnail: string;
      lowRes: string;
      highRes: string;
    };
    metadata: {
      originalFormat: string;
      outputFormat: string;
      originalSize: string;
      outputSize: string;
      colorProfile: string;
    };
    timestamp: string;
  };
  error?: {
    code: string;
    details: string;
  };
}

// 驗證請求資料
const validateRequest = (
  data: StyleTransferRequest
): { isValid: boolean; error?: string } => {
  // 檢查必要欄位
  if (!data.imageId) {
    return { isValid: false, error: "圖片ID不能為空" };
  }

  if (!data.styleId) {
    return { isValid: false, error: "風格ID不能為空" };
  }

  // 驗證強度範圍
  if (data.intensity < 1 || data.intensity > 100) {
    return { isValid: false, error: "風格強度必須在 1-100 之間" };
  }

  // 驗證可選參數
  if (data.options) {
    if (
      data.options.blendMode &&
      !["normal", "multiply", "overlay", "soft_light"].includes(
        data.options.blendMode
      )
    ) {
      return { isValid: false, error: "無效的混合模式" };
    }

    if (
      data.options.outputFormat &&
      !["JPEG", "PNG"].includes(data.options.outputFormat)
    ) {
      return { isValid: false, error: "不支援的輸出格式" };
    }

    if (
      data.options.quality &&
      (data.options.quality < 1 || data.options.quality > 100)
    ) {
      return { isValid: false, error: "品質參數必須在 1-100 之間" };
    }
  }

  return { isValid: true };
};

// 生成假資料回應
const generateMockResponse = (
  requestData: StyleTransferRequest
): StyleTransferResponse => {
  // 模擬處理時間（風格轉換通常需要較長時間）
  const baseProcessingTime = Math.floor(Math.random() * 4000) + 3000; // 3-7秒

  // 根據風格強度調整處理時間
  const intensityMultiplier = requestData.intensity / 100;
  const processingTime = Math.floor(
    baseProcessingTime * (0.8 + intensityMultiplier * 0.4)
  );

  // 整合舊有風格資料庫（來自 /api/style-switch/styles）
  const styleDatabase = {
    "anime-style": { name: "動漫風格", category: "動漫", complexity: "medium" },
    "realistic-style": {
      name: "寫實風格",
      category: "寫實",
      complexity: "medium",
    },
    "oil-painting": { name: "油畫風格", category: "藝術", complexity: "high" },
    watercolor: { name: "水彩風格", category: "藝術", complexity: "low" },
    cyberpunk: { name: "賽博龐克", category: "科幻", complexity: "high" },
    "vintage-film": {
      name: "復古膠片",
      category: "復古",
      complexity: "medium",
    },
    sketch: { name: "素描風格", category: "藝術", complexity: "low" },
    cartoon: { name: "卡通風格", category: "動漫", complexity: "medium" },
    portrait: { name: "人像風格", category: "寫實", complexity: "medium" },
    landscape: { name: "風景風格", category: "寫實", complexity: "medium" },
    // 新增經典藝術風格（保持原有的高級風格）
    van_gogh_starry: {
      name: "星夜",
      category: "印象派",
      artist: "梵谷",
      complexity: "high",
    },
    picasso_cubist: {
      name: "立體主義",
      category: "現代藝術",
      artist: "畢卡索",
      complexity: "high",
    },
    monet_water: {
      name: "睡蓮",
      category: "印象派",
      artist: "莫內",
      complexity: "medium",
    },
  };

  const selectedStyle = styleDatabase[
    requestData.styleId as keyof typeof styleDatabase
  ] || {
    name: "未知風格",
    category: "其他",
    complexity: "medium" as const,
    artist: undefined,
  };

  // 模擬品質分數
  const qualityScore = Math.floor(Math.random() * 15) + 80; // 80-95分

  // 模擬記憶體使用量
  const memoryUsages = ["1.2GB", "1.8GB", "2.4GB", "3.1GB"];
  const memoryUsed =
    memoryUsages[Math.floor(Math.random() * memoryUsages.length)];

  // AI 模型選擇
  const aiModels = [
    "StyleGAN-Ultra",
    "ArtTransform-Pro",
    "NeuralStyle-v4",
    "StyleNet-Advanced",
  ];
  const selectedModel = aiModels[Math.floor(Math.random() * aiModels.length)];

  // 生成模擬的處理後圖片 URL
  const outputFormat = requestData.options?.outputFormat || "JPEG";
  const mockImageUrl = `https://api.psf.com/style-transfer/${
    requestData.imageId
  }_${requestData.styleId}_${
    requestData.intensity
  }.${outputFormat.toLowerCase()}`;

  return {
    success: true,
    message: "風格轉換成功",
    data: {
      processedImageUrl: mockImageUrl,
      originalImageUrl: `https://api.psf.com/original/${requestData.imageId}.jpg`,
      appliedStyle: {
        id: requestData.styleId,
        name: selectedStyle.name,
        category: selectedStyle.category,
        artist: (selectedStyle as { artist: string }).artist,
        intensity: requestData.intensity,
      },
      processingStats: {
        processingTime: processingTime / 1000,
        aiModelUsed: selectedModel,
        styleComplexity: selectedStyle.complexity as "low" | "medium" | "high",
        qualityScore,
        memoryUsed,
      },
      previewUrls: {
        thumbnail: `https://api.psf.com/previews/${requestData.imageId}_${requestData.styleId}_thumb.jpg`,
        lowRes: `https://api.psf.com/previews/${requestData.imageId}_${requestData.styleId}_low.jpg`,
        highRes: mockImageUrl,
      },
      metadata: {
        originalFormat: "JPEG",
        outputFormat: outputFormat,
        originalSize: "1920x1080",
        outputSize: "1920x1080",
        colorProfile: "sRGB",
      },
      timestamp: new Date().toISOString(),
    },
  };
};

// 模擬錯誤回應
const generateErrorResponse = (
  errorCode: string,
  errorDetails: string
): StyleTransferResponse => {
  return {
    success: false,
    message: "風格轉換失敗",
    error: {
      code: errorCode,
      details: errorDetails,
    },
  };
};

export async function POST(request: NextRequest) {
  try {
    console.log("收到風格轉換請求");

    // 解析請求資料
    const requestData: StyleTransferRequest = await request.json();
    console.log("請求資料:", JSON.stringify(requestData, null, 2));

    // 驗證請求資料
    const validation = validateRequest(requestData);
    if (!validation.isValid) {
      const errorResponse = generateErrorResponse(
        "VALIDATION_ERROR",
        validation.error || "未知驗證錯誤"
      );

      console.log("驗證失敗:", JSON.stringify(errorResponse, null, 2));
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // 模擬處理延遲（風格轉換需要較長時間）
    console.log("開始模擬風格轉換處理...");
    await new Promise((resolve) =>
      setTimeout(resolve, Math.floor(Math.random() * 3000) + 2000)
    ); // 2-5秒

    // 模擬偶爾的處理失敗（10% 機率，風格轉換失敗率較高）
    if (Math.random() < 0.1) {
      const errorTypes = [
        { code: "STYLE_NOT_FOUND", details: "指定的風格不存在或暫時無法使用" },
        {
          code: "INSUFFICIENT_MEMORY",
          details: "系統記憶體不足，無法處理該風格轉換",
        },
        { code: "AI_MODEL_OVERLOAD", details: "AI 模型負載過高，請稍後重試" },
        {
          code: "STYLE_COMPLEXITY_TOO_HIGH",
          details: "該風格過於複雜，建議降低強度或選擇其他風格",
        },
        {
          code: "IMAGE_RESOLUTION_TOO_HIGH",
          details: "圖片解析度過高，請使用較小的圖片",
        },
      ];

      const randomError =
        errorTypes[Math.floor(Math.random() * errorTypes.length)];
      const errorResponse = generateErrorResponse(
        randomError.code,
        randomError.details
      );
      console.log("模擬風格轉換失敗:", JSON.stringify(errorResponse, null, 2));
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // 生成假資料回應
    const responseData = generateMockResponse(requestData);
    console.log(
      "風格轉換完成，回應資料:",
      JSON.stringify(responseData, null, 2)
    );

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("處理風格轉換請求時發生錯誤:", error);

    const errorResponse = generateErrorResponse(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "未知錯誤"
    );

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// GET 方法用於獲取可用的風格列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // 新增：支援預覽功能（來自舊 preview API）
    const imageId = searchParams.get("imageId");
    const styleId = searchParams.get("styleId");
    const intensity = searchParams.get("intensity");

    // 如果是預覽請求
    if (imageId && styleId) {
      const intensityValue = intensity ? parseInt(intensity) : 80;

      // 驗證預覽參數
      if (intensityValue < 0 || intensityValue > 100) {
        return NextResponse.json(
          {
            success: false,
            error: "強度值必須在 0-100 之間",
          },
          { status: 400 }
        );
      }

      // 模擬預覽生成時間
      const processingTime = Math.random() * 1000 + 500; // 0.5-1.5 秒
      await new Promise((resolve) => setTimeout(resolve, processingTime));

      // 生成預覽 URL
      const previewUrl = `/api/preview-images/${imageId}-${styleId}-${intensityValue}.jpg`;

      return NextResponse.json({
        success: true,
        data: {
          previewUrl,
          processingTime: Math.round(processingTime),
        },
      });
    }

    // 整合舊有風格目錄（來自 /api/style-switch/styles）
    const allStyles = [
      {
        id: "anime-style",
        name: "動漫風格",
        category: "動漫",
        description: "經典動漫畫風，適合角色設計",
        thumbnailUrl: "/api/placeholder/300/300",
        previewUrl: "https://api.psf.com/styles/anime-style_preview.jpg",
        difficulty: "medium",
        processingTime: "3-5秒",
        popularity: 95,
        isPopular: true,
        tags: ["動漫", "角色", "AI生成"],
      },
      {
        id: "realistic-style",
        name: "寫實風格",
        category: "寫實",
        description: "逼真的寫實風格，適合風景攝影",
        thumbnailUrl: "/api/placeholder/300/300",
        previewUrl:
          "https://api.psf.com/styles/realistic-style_preview.jpg",
        difficulty: "medium",
        processingTime: "4-6秒",
        popularity: 88,
        isPopular: true,
        tags: ["寫實", "攝影", "AI生成"],
      },
      {
        id: "oil-painting",
        name: "油畫風格",
        category: "藝術",
        description: "古典油畫質感，藝術氣息濃厚",
        thumbnailUrl: "/api/placeholder/300/300",
        previewUrl: "https://api.psf.com/styles/oil-painting_preview.jpg",
        difficulty: "high",
        processingTime: "5-8秒",
        popularity: 76,
        isPopular: false,
        tags: ["藝術", "油畫", "AI生成"],
      },
      {
        id: "watercolor",
        name: "水彩風格",
        category: "藝術",
        description: "清新水彩畫風，柔和自然",
        thumbnailUrl: "/api/placeholder/300/300",
        previewUrl: "https://api.psf.com/styles/watercolor_preview.jpg",
        difficulty: "low",
        processingTime: "2-4秒",
        popularity: 83,
        isPopular: true,
        tags: ["藝術", "水彩", "AI生成"],
      },
      {
        id: "cyberpunk",
        name: "賽博龐克",
        category: "科幻",
        description: "未來科技風格，霓虹燈效果",
        thumbnailUrl: "/api/placeholder/300/300",
        previewUrl: "https://api.psf.com/styles/cyberpunk_preview.jpg",
        difficulty: "high",
        processingTime: "6-9秒",
        popularity: 72,
        isPopular: false,
        tags: ["科幻", "未來", "AI生成"],
      },
      {
        id: "vintage-film",
        name: "復古膠片",
        category: "復古",
        description: "老式膠片質感，懷舊氛圍",
        thumbnailUrl: "/api/placeholder/300/300",
        previewUrl: "https://api.psf.com/styles/vintage-film_preview.jpg",
        difficulty: "medium",
        processingTime: "3-5秒",
        popularity: 65,
        isPopular: false,
        tags: ["復古", "膠片", "AI生成"],
      },
      {
        id: "sketch",
        name: "素描風格",
        category: "藝術",
        description: "鉛筆素描效果，簡潔有力",
        thumbnailUrl: "/api/placeholder/300/300",
        previewUrl: "https://api.psf.com/styles/sketch_preview.jpg",
        difficulty: "low",
        processingTime: "2-3秒",
        popularity: 68,
        isPopular: false,
        tags: ["藝術", "素描", "AI生成"],
      },
      {
        id: "cartoon",
        name: "卡通風格",
        category: "動漫",
        description: "可愛卡通風格，適合兒童內容",
        thumbnailUrl: "/api/placeholder/300/300",
        previewUrl: "https://api.psf.com/styles/cartoon_preview.jpg",
        difficulty: "medium",
        processingTime: "3-5秒",
        popularity: 91,
        isPopular: true,
        tags: ["動漫", "卡通", "AI生成"],
      },
      {
        id: "portrait",
        name: "人像風格",
        category: "寫實",
        description: "專業人像攝影風格",
        thumbnailUrl: "/api/placeholder/300/300",
        previewUrl: "https://api.psf.com/styles/portrait_preview.jpg",
        difficulty: "medium",
        processingTime: "4-6秒",
        popularity: 87,
        isPopular: true,
        tags: ["寫實", "人像", "AI生成"],
      },
      {
        id: "landscape",
        name: "風景風格",
        category: "寫實",
        description: "自然風景攝影風格",
        thumbnailUrl: "/api/placeholder/300/300",
        previewUrl: "https://api.psf.com/styles/landscape_preview.jpg",
        difficulty: "medium",
        processingTime: "4-6秒",
        popularity: 79,
        isPopular: false,
        tags: ["寫實", "風景", "AI生成"],
      },
      // 新增經典藝術風格
      {
        id: "van_gogh_starry",
        name: "星夜風格",
        category: "印象派",
        artist: "梵谷",
        description: "梵谷經典的星夜畫作風格，充滿動感的筆觸",
        thumbnailUrl:
          "https://api.psf.com/styles/van_gogh_starry_thumb.jpg",
        previewUrl:
          "https://api.psf.com/styles/van_gogh_starry_preview.jpg",
        difficulty: "high",
        processingTime: "5-8秒",
        popularity: 95,
        isPopular: true,
        tags: ["印象派", "經典", "藝術"],
      },
      {
        id: "picasso_cubist",
        name: "立體主義",
        category: "現代藝術",
        artist: "畢卡索",
        description: "畢卡索的立體主義風格，幾何化的視覺效果",
        thumbnailUrl: "https://api.psf.com/styles/picasso_cubist_thumb.jpg",
        previewUrl: "https://api.psf.com/styles/picasso_cubist_preview.jpg",
        difficulty: "high",
        processingTime: "6-9秒",
        popularity: 88,
        isPopular: true,
        tags: ["現代藝術", "經典", "幾何"],
      },
    ];

    // 支援舊有的搜尋和篩選功能
    let filteredStyles = [...allStyles];

    // 按類別篩選
    if (category && category !== "全部") {
      filteredStyles = filteredStyles.filter(
        (style) => style.category === category
      );
    }

    // 按搜索關鍵詞篩選（與舊 API 兼容）
    const search = searchParams.get("search");
    if (search) {
      const searchLower = search.toLowerCase();
      filteredStyles = filteredStyles.filter(
        (style) =>
          style.name.toLowerCase().includes(searchLower) ||
          style.description.toLowerCase().includes(searchLower) ||
          style.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // 只顯示熱門風格（與舊 API 兼容）
    const popular = searchParams.get("popular");
    if (popular === "true") {
      filteredStyles = filteredStyles.filter((style) => style.isPopular);
    }

    const mockStyleCatalog = {
      success: true,
      message: "查詢成功",
      data: {
        styles: filteredStyles,
        categories: [
          { id: "impressionist", name: "印象派", count: 25 },
          { id: "modern", name: "現代藝術", count: 18 },
          { id: "anime", name: "動漫", count: 15 },
          { id: "classical", name: "古典", count: 12 },
          { id: "abstract", name: "抽象", count: 10 },
          { id: "realistic", name: "寫實", count: 8 },
        ],
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(filteredStyles.length / limit),
          totalStyles: filteredStyles.length,
          hasNext: page * limit < filteredStyles.length,
          hasPrev: page > 1,
        },
        // 新增：與舊 API 兼容的總數和篩選標記
        total: filteredStyles.length,
        processingInfo: {
          averageTime: "4.2秒",
          successRate: "92%",
          supportedFormats: ["JPEG", "PNG"],
          maxFileSize: "10MB",
          recommendedResolution: "1024x1024",
        },
      },
    };

    // 如果指定了分類，過濾結果
    if (category) {
      mockStyleCatalog.data.styles = mockStyleCatalog.data.styles.filter(
        (style) => style.category.toLowerCase() === category.toLowerCase()
      );
    }

    return NextResponse.json(mockStyleCatalog);
  } catch (error) {
    console.error("查詢風格列表時發生錯誤:", error);

    return NextResponse.json(
      {
        success: false,
        message: "查詢失敗",
        error: {
          code: "QUERY_ERROR",
          details: error instanceof Error ? error.message : "未知錯誤",
        },
      },
      { status: 500 }
    );
  }
}
