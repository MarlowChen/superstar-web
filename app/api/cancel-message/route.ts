// app/api/create-message/route.ts
import { NextRequest, NextResponse } from "next/server";
import { apiMessageService } from "@/app/services/api-message-service";

export async function POST(request: NextRequest) {
  try {
    const { uuid, conversationId, messageId } = await request.json();

    const result =
      await apiMessageService.cancelMessage(
        uuid,
        conversationId,
        messageId
      );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error creating message" },
      { status: 500 }
    );
  }
}
