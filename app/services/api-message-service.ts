// src/services/api-services.ts

import { Conversation, LoraModel, PublishedPost, Task } from "@/payload-types";
import apiClient from "../lib/api-client";

export interface CreateUserData {
  name: string;
  email: string;
}

export const apiMessageService = {
  getTasks: () => apiClient.get<Task[]>(`/task/list`),
  getModels: () => apiClient.get<LoraModel[]>(`/models/basic`),
  getMessages: (id: string, nodeId?: string) =>
    apiClient.get<string>(
      `/chat/${id}/messages${nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : ""}`
    ),
  getConversations: () => apiClient.get<Conversation[]>(`/conversations`),
  createConversation: (message: string, loraId: string) =>
    apiClient.post<{ conversationId: string }>(`/conversation`, {
      message,
      loraId,
    }),
  createMessage: (
    uuid: string,
    id: string,
    message: string,
    loraId: string,
    messageId: string
  ) =>
    apiClient.post<{ messageId: string }>(`/conversation/${id}/message`, {
      uuid,
      message,
      loraId,
      messageId,
    }),
  regenerateMessage: (
    uuid: string,
    id: string,
    messageId: string,
    loraId: string
  ) =>
    apiClient.post<{ messageId: string }>(`/message/${id}/regenerate`, {
      uuid,
      messageId,
      loraId,
    }),

  toggleReaction: (
    conversationId: string,
    messageId: string,
    imageId: string,
    reactionType: "like" | "dislike"
  ) =>
    apiClient.post<{ messageId: string }>(`/image/${imageId}/reaction`, {
      conversationId,
      messageId,
      imageId,
      reactionType,
    }),

  toggleReactionPage: (
    conversationId: string,
    messageId: string,
    imageId: string,
    reactionType: "like" | "dislike",
    page: number,
    limit: number,
    sort: string
  ) =>
    apiClient.post<{ messageId: string }>(
      `/image/${imageId}/reaction/${page}/${limit}/${sort}`,
      {
        conversationId,
        messageId,
        imageId,
        reactionType,
      }
    ),

  toggleReactionComment: (
    conversationId: string,
    messageId: string,
    imageId: string,
    comment: string
  ) =>
    apiClient.post<{ messageId: string }>(`/image/${imageId}/comment`, {
      conversationId,
      messageId,
      imageId,
      comment,
    }),

  toggleReactionCommentPage: (
    conversationId: string,
    messageId: string,
    imageId: string,
    comment: string,
    page: number,
    limit: number,
    sort: string
  ) =>
    apiClient.post<{ messageId: string }>(
      `/image/${imageId}/comment/${page}/${limit}/${sort}`,
      {
        conversationId,
        messageId,
        imageId,
        comment,
      }
    ),

  cancelMessage: (uuid: string, id: string, messageId: string) =>
    apiClient.post<{ messageId: string }>(`/message/${id}/cancel`, {
      uuid,
      messageId,
    }),
  updateTitle: (id: string, title: string) =>
    apiClient.post<{ messageId: string }>(`/conversation/${id}/title`, {
      title,
    }),
  publishPost: (
    title: string,
    description: string,
    publishedImages: string[]
  ) =>
    apiClient.post<{ messageId: string }>(`/post`, {
      title,
      description,
      publishedImages,
    }),

  getPostDetailsByMessageIdAndContentIndex: (
    messageId: string,
    contentIndex: number
  ) =>
    apiClient.get<PublishedPost>(
      `/post/assistant/${messageId}/${contentIndex}`
    ),

  subscribe: (transactionType: string, paymentType: string) =>
    apiClient.get<{ messageId: string }>(`/subscribe?transactionType=${transactionType}&paymentType=${paymentType}`),
};

// 你可以為其他實體添加更多服務
