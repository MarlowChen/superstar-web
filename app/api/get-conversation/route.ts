import { NextResponse } from "next/server";
import { apiMessageService } from "@/app/services/api-message-service";

export async function POST() {
  try {
    const result = await apiMessageService.getConversations();

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error creating message" },
      { status: 500 }
    );
  }
}
