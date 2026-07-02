import { useAuth } from "@/app/context/AuthContext";
import { useState } from "react";

interface ReactionState {
  [imageId: string]: {
    like: boolean;
    dislike: boolean;
    comment?: string;
  };
}

const useReactions = () => {
  const { authenticatedRequest } = useAuth();
  const [reactions, setReactions] = useState<ReactionState>({});

  const toggleReaction = async (
    imageId: string,
    reactionType: "like" | "dislike",
    page?: number,
    limit?: number,
    sort?: "desc" | "asc"
  ) => {
    // 保存當前狀態以便回滾
    const previousState = reactions[imageId] || { like: false, dislike: false };

    // 樂觀更新
    setReactions((prev) => ({
      ...prev,
      [imageId]: {
        ...previousState,
        [reactionType]: !previousState[reactionType],
        [reactionType === "like" ? "dislike" : "like"]: false,
      },
    }));

    try {
      // 根據正確的路由發送請求
      const response = await authenticatedRequest(`${process.env.NEXT_PUBLIC_SERVER_URL}/image/${imageId}/reaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          reactionType,
          page,
          limit,
          sort,
        }),
      });

      if (!response || !response.ok) {
        throw new Error("Failed to toggle reaction");
      }

      const result = await response.json();
      // 可以用服務器返回的數據更新狀態，以確保完全同步
      setReactions((prev) => ({
        ...prev,
        [imageId]: result.reaction,
      }));
    } catch (error) {
      console.error("Error toggling reaction:", error);
      // 如果請求失敗，回滾到之前的狀態
      setReactions((prev) => ({
        ...prev,
        [imageId]: previousState,
      }));
      // 可以在這裡添加一個錯誤通知給用戶
    }
  };

  const toggleReactionComment = async (
    imageId: string,
    comment: string,
    page?: number,
    limit?: number,
    sort?: "desc" | "asc"
  ) => {
    // 保存當前狀態以便回滾
    const previousState = reactions[imageId] || { 
      like: false, 
      dislike: false,
      comment: "" 
    };

    // 樂觀更新
    setReactions((prev) => ({
      ...prev,
      [imageId]: {
        ...previousState,
        comment,
      },
    }));

    try {
      // 根據正確的路由發送請求
      const response = await authenticatedRequest(`${process.env.NEXT_PUBLIC_SERVER_URL}/image/${imageId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment,
          page,
          limit,
          sort,
        }),
      });

      if (!response || !response.ok) {
        throw new Error("Failed to update comment");
      }

      const result = await response.json();
      // 可以用服務器返回的數據更新狀態，以確保完全同步
      setReactions((prev) => ({
        ...prev,
        [imageId]: result.reaction,
      }));
    } catch (error) {
      console.error("Error updating comment:", error);
      // 如果請求失敗，回滾到之前的狀態
      setReactions((prev) => ({
        ...prev,
        [imageId]: previousState,
      }));
      // 可以在這裡添加一個錯誤通知給用戶
    }
  };

  return { reactions, toggleReaction, toggleReactionComment };
};

export default useReactions;
