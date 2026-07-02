// app/api/create-message/route.ts
import { NextRequest, NextResponse } from "next/server";
import { apiMessageService } from "@/app/services/api-message-service";

export async function POST(request: NextRequest) {
  try {
    const {
      conversationId,
      messageId,
      imageId,
      reactionType,
      page,
      limit,
      sort,
    } = await request.json();

    let result;

    if (page && limit && sort) {
      result = await apiMessageService.toggleReactionPage(
        conversationId,
        messageId,
        imageId,
        reactionType,
        page,
        limit,
        sort
      );
    } else {
      result = await apiMessageService.toggleReaction(
        conversationId,
        messageId,
        imageId,
        reactionType
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error creating message" },
      { status: 500 }
    );
  }
}
