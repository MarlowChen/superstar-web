import { NextRequest, NextResponse } from "next/server";
import { getMeUser } from "../../../utilities/getUser";

interface EditedImage {
  id: string;
  originalImageId: string;
  originalImageUrl: string;
  editedImageUrl: string;
  editHistory: EditOperation[];
  createdAt: string;
  source: 'drawing' | 'library';
  prompt: string;
  modelName: string;
}

interface EditOperation {
  type: string;
  timestamp: string;
  description: string;
}

// 簡單的內存存儲（在實際生產環境中應該使用數據庫）
const editedImagesStore: Map<string, EditedImage[]> = new Map();

// 添加測試數據
console.log('🔧 API 文件已載入，內存存儲初始化');

// 測試端點 - 檢查內存存儲狀態
export async function HEAD() {
  console.log('🔧 HEAD 請求 - 檢查內存存儲狀態');
  console.log('🔧 內存存儲大小:', editedImagesStore.size);
  console.log('🔧 內存存儲所有用戶ID:', Array.from(editedImagesStore.keys()));
  return new NextResponse(null, { status: 200 });
}

// 獲取編輯圖片列表
export async function GET(request: NextRequest) {
  try {
    const { user } = await getMeUser({
      nullUserRedirect: undefined,
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const sort = searchParams.get("sort") || "newest";
    const source = searchParams.get("source") || "";

    console.log('🔍 GET /api/user/edited-images 被調用');
    console.log('🔍 用戶ID:', user.id, '類型:', typeof user.id);
    console.log('🔍 查詢參數:', { page, limit, sort, source });

    // 從內存存儲獲取用戶的編輯圖片
    const userEditedImages = editedImagesStore.get(user.id) || [];
    console.log('📊 內存存儲中的圖片數量:', userEditedImages.length);
    console.log('📊 內存存儲的所有用戶ID:', Array.from(editedImagesStore.keys()));
    console.log('📊 內存存儲的所有數據:', Array.from(editedImagesStore.entries()));
    console.log('🔍 嘗試獲取用戶ID:', user.id, '是否存在:', editedImagesStore.has(user.id));

    // 過濾和排序
    let filteredImages = userEditedImages;
    
    if (source && source !== 'all') {
      filteredImages = filteredImages.filter(img => img.source === source);
    }

    // 排序
    if (sort === "newest") {
      filteredImages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === "oldest") {
      filteredImages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    // 分頁
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedImages = filteredImages.slice(startIndex, endIndex);
    const totalCount = filteredImages.length;
    const totalPages = Math.ceil(totalCount / limit);

    console.log('📊 返回數據:', {
      imagesCount: paginatedImages.length,
      totalCount,
      totalPages,
      currentPage: page
    });

    return NextResponse.json({
      images: paginatedImages,
      totalPages,
      currentPage: page,
      totalCount
    });

  } catch (error) {
    console.error("Failed to fetch edited images:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 保存編輯圖片
export async function POST(request: NextRequest) {
  console.log('🔍 POST /api/user/edited-images 被調用');
  
  try {
    const { user } = await getMeUser({
      nullUserRedirect: undefined,
    });

    console.log('🔍 用戶信息:', { 
      userId: user?.id, 
      userIdType: typeof user?.id,
      email: user?.email,
      userObject: user
    });

    if (!user) {
      console.log('❌ 用戶未授權');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 檢查是否為付費用戶
    if ((user as { pointType?: string }).pointType === "FREE") {
      console.log('❌ 免費用戶嘗試使用付費功能');
      return NextResponse.json(
        { error: "Premium feature only" },
        { status: 403 }
      );
    }

    console.log('✅ 用戶驗證通過');

    const formData = await request.formData();
    const editedImage = formData.get("editedImage") as File;
    const originalImageId = formData.get("originalImageId") as string;
    const prompt = formData.get("prompt") as string;
    const modelName = formData.get("modelName") as string;
    const source = formData.get("source") as string;

    console.log('📝 接收到的表單數據:');
    console.log('  - editedImage:', editedImage ? '存在' : '缺失', editedImage?.type, editedImage?.size);
    console.log('  - originalImageId:', originalImageId);
    console.log('  - prompt:', prompt);
    console.log('  - modelName:', modelName);
    console.log('  - source:', source);

    if (!editedImage || !originalImageId || !source) {
      console.log('❌ 缺少必需字段:');
      console.log('  - editedImage:', !editedImage);
      console.log('  - originalImageId:', !originalImageId);
      console.log('  - source:', !source);
      
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 為空值提供默認值
    const finalPrompt = prompt || 'AI Generated Image';
    const finalModelName = modelName || 'AI Model';

    console.log('✅ 使用最終值:');
    console.log('  - finalPrompt:', finalPrompt);
    console.log('  - finalModelName:', finalModelName);

    // 將編輯後的圖片轉換為 base64
    const arrayBuffer = await editedImage.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = editedImage.type || 'image/png';
    const savedImageUrl = `data:${mimeType};base64,${base64}`;

    // 保存到內存存儲
    const savedImage: EditedImage = {
      id: Date.now().toString(),
      originalImageId,
      originalImageUrl: "https://via.placeholder.com/512x512/FF6B6B/FFFFFF?text=Original",
      editedImageUrl: savedImageUrl,
      editHistory: [
        {
          type: "save",
          timestamp: new Date().toISOString(),
          description: "保存編輯後的圖片"
        }
      ],
      createdAt: new Date().toISOString(),
      source: source as "drawing" | "library",
      prompt: finalPrompt,
      modelName: finalModelName
    };

    // 將圖片保存到用戶的編輯圖片集合中
    const userImages = editedImagesStore.get(user.id) || [];
    userImages.push(savedImage);
    editedImagesStore.set(user.id, userImages);

    console.log('💾 已保存到內存存儲，用戶ID:', user.id, '類型:', typeof user.id);
    console.log('💾 該用戶的編輯圖片總數:', userImages.length);
    console.log('💾 內存存儲中的所有用戶ID:', Array.from(editedImagesStore.keys()));
    console.log('💾 保存的圖片數據:', savedImage);
    
    // 立即驗證保存是否成功
    const verifyImages = editedImagesStore.get(user.id) || [];
    console.log('✅ 驗證保存結果 - 用戶ID:', user.id, '圖片數量:', verifyImages.length);
    console.log('✅ 驗證保存結果 - 最新圖片ID:', verifyImages[verifyImages.length - 1]?.id);

    return NextResponse.json({
      success: true,
      image: savedImage
    });

  } catch (error) {
    console.error("Failed to save edited image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 刪除編輯圖片
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getMeUser({
      nullUserRedirect: undefined,
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const imageId = url.pathname.split('/').pop();

    if (!imageId) {
      return NextResponse.json({ error: "Image ID required" }, { status: 400 });
    }

    // 從內存存儲中刪除圖片
    const userImages = editedImagesStore.get(user.id) || [];
    const updatedImages = userImages.filter(img => img.id !== imageId);
    editedImagesStore.set(user.id, updatedImages);

    console.log('🗑️ 已刪除編輯圖片，用戶ID:', user.id, '圖片ID:', imageId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Failed to delete edited image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
