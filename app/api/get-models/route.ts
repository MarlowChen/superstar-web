// app/api/create-message/route.ts
import { NextResponse } from "next/server";
import { apiMessageService } from "@/app/services/api-message-service";
import { isMockAuthEnabled, MOCK_BASIC_MODELS } from "@/app/lib/mockAuth";

export async function POST() {
  try {
    if (isMockAuthEnabled()) {
      return NextResponse.json({ result: MOCK_BASIC_MODELS }, { status: 200 });
    }

   // const { conversationId, nodeId } = await request.json();

    const result =
      await apiMessageService.getModels();

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error creating message" },
      { status: 500 }
    );
  }
}
