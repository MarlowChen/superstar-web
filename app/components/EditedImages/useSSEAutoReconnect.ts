import { useEffect, useRef } from 'react';
import { TaskStatus } from '../Drawing/types';
import { PublishedImage } from '@/payload-types';
type TaskEnvelope = {
    id?: string;
    _id?: string;
    status: TaskStatus;
    prompt?: string;
    loraModel?: string;
    createdAt?: string;
    publishedImages?: PublishedImage[];
    compositorData?: unknown;
  };
export function useSSEAutoReconnect(
  userId: string,
  onTaskUpdate?: (data: TaskEnvelope) => void
) {
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
  const heartbeatTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map());
  const lastEventIdsRef = useRef<Map<string, string>>(new Map());
  const reconnectedRef = useRef(false);

  const cleanupTask = (taskId: string) => {
    const es = eventSourcesRef.current.get(taskId);
    if (es) {
      try {
        es.close();
      } catch {}
      eventSourcesRef.current.delete(taskId);
    }

    const heartbeatTimer = heartbeatTimersRef.current.get(taskId);
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
      heartbeatTimersRef.current.delete(taskId);
    }
  };

  const resetHeartbeat = (taskId: string) => {
    const existingTimer = heartbeatTimersRef.current.get(taskId);
    if (existingTimer) clearTimeout(existingTimer);

    heartbeatTimersRef.current.set(
      taskId,
      setTimeout(() => {
        const es = eventSourcesRef.current.get(taskId);
        if (es) {
          try {
            es.close();
          } catch {}
        }
      }, 15000)
    );
  };

  useEffect(() => {
    if (reconnectedRef.current) return;
    reconnectedRef.current = true;

    const reconnect = async () => {
      try {
        // 1. 獲取用戶所有任務
        const res = await fetch(`/api/task/list`, {
          credentials: "include",
          cache: "no-store",
        });
        
        if (!res.ok) return;
        
        const { result: tasks } = await res.json();
        
        // 2. 過濾進行中的任務（非 COMPLETED/FAILED）
        const activeTasks = tasks.filter((t: {status : TaskStatus}) => 
          t.status !== "COMPLETED" && t.status !== "FAILED"
        );

        if (activeTasks.length === 0) return;

        console.log(`[SSE] 重連 ${activeTasks.length} 個進行中任務`);

        // 3. 為每個任務建立 SSE
        for (const task of activeTasks) {
          const taskId = task.id;
          
          if (eventSourcesRef.current.has(taskId)) continue;

          const url = new URL(`/api/task-sse/stream`, window.location.origin);
          url.searchParams.set("userId", userId);
          url.searchParams.set("taskId", taskId);
          const lastEventId = lastEventIdsRef.current.get(taskId);
          if (lastEventId) {
            url.searchParams.set("replay", "1");
            url.searchParams.set("after", lastEventId);
          }

          const es = new EventSource(url.toString(), { withCredentials: true });
          eventSourcesRef.current.set(taskId, es);

          es.addEventListener("open", () => {
            reconnectAttemptsRef.current.set(taskId, 0);
            resetHeartbeat(taskId);
          });

          es.addEventListener("heartbeat", () => {
            resetHeartbeat(taskId);
          });

          es.addEventListener("status", (e: MessageEvent) => {
            try {
              if (e.lastEventId) {
                lastEventIdsRef.current.set(taskId, e.lastEventId);
              }
              resetHeartbeat(taskId);
              const data = JSON.parse(e.data);
              onTaskUpdate?.({ id: taskId, ...data });

              if (data.status === "COMPLETED" || data.status === "FAILED") {
                cleanupTask(taskId);
              }
            } catch {}
          });

          es.addEventListener("error", () => {
            cleanupTask(taskId);

            if (es.readyState !== EventSource.CLOSED) {
              return;
            }

            const currentAttempt = reconnectAttemptsRef.current.get(taskId) || 0;
            if (currentAttempt >= 5) {
              return;
            }

            const nextAttempt = currentAttempt + 1;
            reconnectAttemptsRef.current.set(taskId, nextAttempt);
            const delay = Math.min(1000 * Math.pow(2, nextAttempt - 1), 16000);

            window.setTimeout(() => {
              if (eventSourcesRef.current.has(taskId)) return;
              void reconnect();
            }, delay);
          });
        }
      } catch (err) {
        console.error("[SSE] 重連失敗:", err);
      }
    };

    setTimeout(reconnect, 500);

    return () => {
      eventSourcesRef.current.forEach((_, taskId) => cleanupTask(taskId));
      reconnectAttemptsRef.current.clear();
      lastEventIdsRef.current.clear();
    };
  }, []);
}
