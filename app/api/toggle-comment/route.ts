// app/api/create-message/route.ts
import { NextRequest, NextResponse } from "next/server";
import { apiMessageService } from "@/app/services/api-message-service";

export async function POST(request: NextRequest) {
  try {
    const {
      conversationId,
      messageId,
      imageId,
      comment,
      page,
      limit,
      sort,
    } = await request.json();

    let result;

    if (page && limit && sort) {
      result = await apiMessageService.toggleReactionCommentPage(
        conversationId,
        messageId,
        imageId,
        comment,
        page,
        limit,
        sort
      );
    } else {
      result = await apiMessageService.toggleReactionComment(
        conversationId,
        messageId,
        imageId,
        comment
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
