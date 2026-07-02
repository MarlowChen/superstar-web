import { Branch } from "@/payload-types";
import { useEffect } from "react";

export const useMessageSSE = (lastBranch: Branch | null, updateMessage: (object: { data: string, status: string })  => void) => {
  useEffect(() => {
    if (!lastBranch || lastBranch.status !== "pending") return;

    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2秒
    let isConnected = false;

    const connect = async () => {
      try {
        if (isConnected) return;
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SERVER_URL}/conversation/sse/${lastBranch.id}`,
          {
            credentials: "include",
          }
        );

        isConnected = true;
        retryCount = 0; // 重置重試次數

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        while (true) {
          try {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            const lines = text.split("\n\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = JSON.parse(line.slice(6));
                updateMessage(data);
                
                // 如果收到完成或錯誤狀態,終止連接
                if (data.status === "completed" || data.status === "error") {
                  isConnected = false;
                  return;
                }
              }
            }
          } catch (parseError) {
            console.error("Data parsing error:", parseError);
            continue; // 繼續讀取下一段數據
          }
        }
      } catch (error) {
        console.error("SSE Connection error:", error);
        isConnected = false;

        // 實現重試邏輯
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          setTimeout(() => {
            console.log(`Retrying connection... Attempt ${retryCount}`);
            connect();
          }, RETRY_DELAY * retryCount); // 指數退避
        } else {
          updateMessage({ 
            status: "Error",
            data: JSON.stringify({ error: "Connection failed after multiple attempts" })
          });
        }
      }
    };

    connect();

    // 清理函數
    return () => {
      isConnected = false;
    };
  }, [lastBranch, updateMessage]);
};