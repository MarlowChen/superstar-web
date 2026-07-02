type TaskMedia = {
  url?: string;
  s3_url?: string;
};

export type TaskSsePayload = {
  id?: string;
  _id?: string;
  status?: string;
  publishedImages?: TaskMedia[];
  error?: string;
  errorMessage?: string;
  failureMessage?: string;
  failureCode?: string;
  [key: string]: unknown;
};

type WaitForTaskCompletionOptions<T> = {
  taskId: string;
  userId?: string;
  replayLimit?: number;
  heartbeatTimeoutMs?: number;
  pollingIntervalMs?: number;
  maxWaitMs?: number;
  failureMessage: string;
  interruptedMessage: string;
  resolveWhen?: (payload: TaskSsePayload) => T | undefined;
  isTerminalSuccess?: (payload: TaskSsePayload) => boolean;
  onPayload?: (payload: TaskSsePayload) => void | Promise<void>;
};

const DEFAULT_HEARTBEAT_TIMEOUT_MS = 15000;
const DEFAULT_POLLING_INTERVAL_MS = 5000;
const DEFAULT_MAX_WAIT_MS = 6 * 60 * 1000;

function getTaskErrorMessage(payload: TaskSsePayload, fallback: string) {
  return (
    payload.failureMessage ||
    payload.errorMessage ||
    payload.error ||
    (typeof payload.failureCode === "string" ? payload.failureCode : "") ||
    fallback
  );
}

function createTaskSseUrl(taskId: string, userId: string, replayLimit: number, lastEventId?: string) {
  const url = new URL("/api/task-sse/stream", window.location.origin);
  url.searchParams.set("taskId", taskId);
  url.searchParams.set("userId", userId || "guest");
  url.searchParams.set("limit", String(replayLimit));

  if (lastEventId) {
    url.searchParams.set("replay", "1");
    url.searchParams.set("after", lastEventId);
  }

  return url.toString();
}

async function fetchTaskStatus(taskId: string): Promise<TaskSsePayload | null> {
  const response = await fetch(`/api/task/${encodeURIComponent(taskId)}/status`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as TaskSsePayload;
}

export function waitForTaskCompletion<T = TaskSsePayload>(
  options: WaitForTaskCompletionOptions<T>
): Promise<T> {
  const {
    taskId,
    userId = "guest",
    replayLimit = 10,
    heartbeatTimeoutMs = DEFAULT_HEARTBEAT_TIMEOUT_MS,
    pollingIntervalMs = DEFAULT_POLLING_INTERVAL_MS,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    failureMessage,
    interruptedMessage,
    resolveWhen,
    isTerminalSuccess,
    onPayload,
  } = options;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let eventSource: EventSource | null = null;
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let lastEventId: string | null = null;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      if (pollTimer) clearTimeout(pollTimer);
      if (maxWaitTimer) clearTimeout(maxWaitTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (eventSource) {
        try {
          eventSource.close();
        } catch {
          /* no-op */
        }
        eventSource = null;
      }
      fn();
    };

    const schedulePolling = () => {
      if (settled || pollTimer) return;
      pollTimer = setTimeout(async () => {
        pollTimer = null;
        if (settled) return;

        try {
          const payload = await fetchTaskStatus(taskId);
          if (!payload) {
            schedulePolling();
            return;
          }

          await onPayload?.(payload);

          const resolvedValue = resolveWhen?.(payload);
          if (resolvedValue !== undefined) {
            finish(() => resolve(resolvedValue));
            return;
          }

          if (isTerminalSuccess?.(payload)) {
            finish(() => resolve(payload as T));
            return;
          }

          if (String(payload.status || "").toUpperCase() === "FAILED") {
            finish(() => reject(new Error(getTaskErrorMessage(payload, failureMessage))));
            return;
          }

          schedulePolling();
        } catch {
          schedulePolling();
        }
      }, pollingIntervalMs);
    };

    const resetHeartbeat = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(() => {
        if (eventSource) {
          try {
            eventSource.close();
          } catch {
            /* no-op */
          }
        }
        schedulePolling();
      }, heartbeatTimeoutMs);
    };

    const handlePayload = async (payload: TaskSsePayload) => {
      await onPayload?.(payload);

      const resolvedValue = resolveWhen?.(payload);
      if (resolvedValue !== undefined) {
        finish(() => resolve(resolvedValue));
        return;
      }

      if (isTerminalSuccess?.(payload)) {
        finish(() => resolve(payload as T));
        return;
      }

      if (String(payload.status || "").toUpperCase() === "FAILED") {
        finish(() => reject(new Error(getTaskErrorMessage(payload, failureMessage))));
      }
    };

    const connect = () => {
      if (settled) return;

      try {
        eventSource = new EventSource(
          createTaskSseUrl(taskId, userId, replayLimit, lastEventId || undefined),
          { withCredentials: true }
        );

        eventSource.addEventListener("open", () => {
          reconnectAttempt = 0;
          resetHeartbeat();
        });

        eventSource.addEventListener("heartbeat", () => {
          resetHeartbeat();
        });

        eventSource.addEventListener("status", async (event: MessageEvent) => {
          try {
            if (event.lastEventId) {
              lastEventId = event.lastEventId;
            }
            resetHeartbeat();
            await handlePayload(JSON.parse(event.data) as TaskSsePayload);
          } catch (error) {
            finish(() => reject(error instanceof Error ? error : new Error(interruptedMessage)));
          }
        });

        eventSource.addEventListener("task_finished", async (event: MessageEvent) => {
          try {
            if (event.lastEventId) {
              lastEventId = event.lastEventId;
            }
            resetHeartbeat();
            if (event.data) {
              await handlePayload(JSON.parse(event.data) as TaskSsePayload);
            } else {
              schedulePolling();
            }
          } catch (error) {
            finish(() => reject(error instanceof Error ? error : new Error(interruptedMessage)));
          }
        });

        eventSource.addEventListener("error", () => {
          if (settled) return;

          schedulePolling();

          if (!eventSource) return;

          if (eventSource.readyState === EventSource.CLOSED) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 16000);
            reconnectAttempt += 1;
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              connect();
            }, delay);
          }
        });
      } catch (error) {
        schedulePolling();
        finish(() => reject(error instanceof Error ? error : new Error(interruptedMessage)));
      }
    };

    maxWaitTimer = setTimeout(() => {
      finish(() => reject(new Error(interruptedMessage)));
    }, maxWaitMs);

    schedulePolling();
    connect();
  });
}

export async function waitForTaskFirstMediaUrl(
  options: Omit<WaitForTaskCompletionOptions<string>, "resolveWhen"> & {
    mediaSelector?: (payload: TaskSsePayload) => string | undefined;
  }
) {
  const { mediaSelector, ...rest } = options;

  return waitForTaskCompletion<string>({
    ...rest,
    resolveWhen: (payload) => {
      const selectedUrl = mediaSelector?.(payload);
      if (selectedUrl) return selectedUrl;

      if (String(payload.status || "").toUpperCase() !== "COMPLETED") {
        return undefined;
      }

      const firstImage = Array.isArray(payload.publishedImages)
        ? payload.publishedImages.find((item) => item?.url || item?.s3_url)
        : undefined;

      return firstImage?.url || firstImage?.s3_url;
    },
  });
}

export function waitForTaskSuccess(
  options: Omit<WaitForTaskCompletionOptions<TaskSsePayload>, "resolveWhen"> & {
    isTerminalSuccess?: (payload: TaskSsePayload) => boolean;
  }
) {
  return waitForTaskCompletion<TaskSsePayload>({
    ...options,
    isTerminalSuccess:
      options.isTerminalSuccess ||
      ((payload) => String(payload.status || "").toUpperCase() === "COMPLETED"),
  });
}
