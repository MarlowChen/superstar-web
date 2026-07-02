import { NextRequest, NextResponse } from "next/server";
import { getMeUser } from "@/app/utilities/getUser";

// 刪除編輯圖片
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await getMeUser({
      nullUserRedirect: undefined,
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const imageId = params.id;

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    // TODO: 從數據庫刪除編輯圖片
    // 這裡先模擬刪除成功
    console.log(`Deleting edited image with ID: ${imageId}`);

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully"
    });

  } catch (error) {
    console.error("Failed to delete edited image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}




