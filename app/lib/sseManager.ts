import { useState, useEffect, useCallback } from "react";

export interface SSEEvent {
  uuid: string;
  type: string;
  data: {
    uuid?: string;
    type: string;
    data?: string;
  };
}

interface SSEManagerOptions {
  maxReconnectAttempts: number;
  reconnectTimeout: number;
  connectionTimeout: number;
}

class SSEManager {
  private static instance: SSEManager;
  private eventSource: EventSource | null = null;
  private listeners: Set<(data: SSEEvent) => void> = new Set();
  private userToken: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number;
  private reconnectTimeout: number;
  private readonly CONNECTION_TIMEOUT: number;
  private isConnected: boolean = false;
  private channel: BroadcastChannel;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private heartbeatCheckInterval: NodeJS.Timeout | null = null;
  private lastMessageTime: number = Date.now(); // 記錄最後收到訊息時間

  private constructor(options: SSEManagerOptions) {
    this.maxReconnectAttempts = options.maxReconnectAttempts;
    this.reconnectTimeout = options.reconnectTimeout;
    this.CONNECTION_TIMEOUT = options.connectionTimeout;
    this.channel = new BroadcastChannel("sse_channel");

    this.channel.onmessage = (event) => {
      const data = event.data;
      this.handleEvent(data);
    };

    window.addEventListener("online", () => {
      // console.log("Network is online. Attempting to reconnect SSE.");
      this.attemptReconnect();
    });

    window.addEventListener("offline", () => {
      // console.log("Network is offline.");
    });

    document.addEventListener("visibilitychange", () => {
      // 當頁面從背景回到前臺時檢查連線狀態
      if (!document.hidden) {
        // console.log("Page is visible. Checking SSE connection.");
        if (
          !this.isConnected ||
          !this.eventSource ||
          this.eventSource.readyState === EventSource.CLOSED
        ) {
          // console.log("SSE connection is not active. Attempting to reconnect.");
          this.forceReconnect();
        }
      }
    });

    this.startHeartbeatLocalCheck();
  }

  static getInstance(
    options: SSEManagerOptions = {
      maxReconnectAttempts: 10,
      reconnectTimeout: 1000,
      connectionTimeout: 60000,
    }
  ): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager(options);
    }
    return SSEManager.instance;
  }

  // 新增回來的 checkAndConnect 方法
  async checkAndConnect(): Promise<boolean> {
    // 檢查是否已經有正常的連線
    if (
      this.isConnected &&
      this.eventSource &&
      this.eventSource.readyState === EventSource.OPEN
    ) {
      return true;
    }

    // 如果不是主標籤頁但已有主標籤頁存在，不需要建立連線
    if (!this.isMasterTab() && localStorage.getItem("sse_master")) {
      return true;
    }

    // 如果沒有主標籤頁，成為主標籤頁
    if (!localStorage.getItem("sse_master")) {
      this.becomeMasterTab();
    }

    // 建立或重新建立連線
    // console.log("Connection check failed, attempting to reconnect...");
    return await this.establishConnection();
  }

  async connect(userToken: string): Promise<void> {
    this.userToken = userToken;

    if (!localStorage.getItem("sse_master")) {
      this.becomeMasterTab();
      await this.establishConnection();
    } else if (this.isMasterTab()) {
      await this.establishConnection();
    }

    window.addEventListener("storage", (event) => {
      if (event.key === "sse_master") {
        if (!localStorage.getItem("sse_master")) {
          this.becomeMasterTab();
          this.establishConnection();
        }
      }
    });

    window.addEventListener("beforeunload", () => {
      if (this.isMasterTab()) {
        localStorage.removeItem("sse_master");
      }
    });
  }

  private isMasterTab(): boolean {
    return (
      localStorage.getItem("sse_master") ===
      sessionStorage.getItem("sse_master_id")
    );
  }

  private becomeMasterTab(): void {
    const masterId = Date.now().toString();
    localStorage.setItem("sse_master", masterId);
    sessionStorage.setItem("sse_master_id", masterId);
  }

  private async establishConnection(): Promise<boolean> {
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        if (this.eventSource) {
          this.eventSource.close();
        }

        const url = `${process.env.NEXT_PUBLIC_SERVER_URL}/sse/connect`;
        this.eventSource = new EventSource(url, { withCredentials: true });

        return new Promise((resolve) => {
          if (!this.eventSource) return resolve(false);

          this.eventSource.onopen = () => {
            // console.log("SSE connection established");
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.startConnectionChecker();
            this.lastMessageTime = Date.now();
            resolve(true);
          };

          this.eventSource.onmessage = (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            // 更新最後收到訊息時間
            this.lastMessageTime = Date.now();

            // 廣播給其他標籤
            this.channel.postMessage(data);
            // 當前標籤處理事件
            this.handleEvent(data);
          };

          this.eventSource.onerror = () => {
            console.error("SSE connection error");
            this.isConnected = false;
            this.eventSource?.close();
            this.stopConnectionChecker();
            this.attemptReconnect();
            resolve(false);
          };
        });
      } catch (error) {
        console.error(`Connection attempt ${retries + 1} failed:`, error);
        retries++;
        if (retries < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
        }
      }
    }

    console.error("Failed to establish connection after multiple attempts");
    return false;
  }

  private attemptReconnect(): void {
    if (this.isMasterTab()) {
      // console.log("Attempting to reconnect SSE.");
      this.establishConnection();
    }
  }

  private forceReconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }
    this.isConnected = false;
    this.attemptReconnect();
  }

  private handleEvent(data: {
    uuid?: string;
    type: string;
    data?: string;
  }): void {
    if (data.type === "heartbeat") {
      // console.log("Received heartbeat from server");
      return;
    }

    const { uuid, type, data: eventData } = data as unknown as SSEEvent;
    this.listeners.forEach((callback) => {
      callback({ uuid, type, data: eventData });
    });
  }

  subscribe(callback: (data: SSEEvent) => void): void {
    this.listeners.add(callback);
  }

  unsubscribe(callback: (data: SSEEvent) => void): void {
    this.listeners.delete(callback);
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.stopConnectionChecker();
    this.listeners.clear();
    this.reconnectAttempts = 0;
    this.reconnectTimeout = 1000;
  }

  private startConnectionChecker(): void {
    this.stopConnectionChecker();
    this.connectionCheckInterval = setInterval(() => {
      if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
        // console.log("SSE connection is closed. Attempting to reconnect.");
        this.attemptReconnect();
      }
    }, 5000);
  }

  private stopConnectionChecker(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  // 本地心跳檢查，超過 CONNECTION_TIMEOUT 未收到訊息就強制重連
  private startHeartbeatLocalCheck(): void {
    this.stopHeartbeatLocalCheck();
    this.heartbeatCheckInterval = setInterval(() => {
      if (Date.now() - this.lastMessageTime > this.CONNECTION_TIMEOUT) {
        console.warn("No SSE messages for a long time, forcing reconnect.");
        this.forceReconnect();
      }
    }, 30000);
  }

  private stopHeartbeatLocalCheck(): void {
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
    }
  }
}

export function useSSE(userToken: string): SSEEvent | null {
  const [data, setData] = useState<SSEEvent | null>(null);

  const handleMessage = useCallback((newData: SSEEvent) => {
    console.log("Received SSE data:", newData);
    setData(newData);
  }, []);

  useEffect(() => {
    const manager = SSEManager.getInstance();
    // 使用原本已有的 checkAndConnect 確保連線狀態
    manager.checkAndConnect().then((connected) => {
      if (!connected) {
        // 若尚未連上，則透過 connect 建立
        manager.connect(userToken).then(() => {
          manager.subscribe(handleMessage);
        });
      } else {
        // 已連上時直接訂閱
        manager.subscribe(handleMessage);
      }
    });

    return () => {
      manager.unsubscribe(handleMessage);
    };
  }, [userToken, handleMessage]);

  return data;
}

export default SSEManager;
