import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { cookies } from "next/headers";

class ApiClient {
  private static instance: ApiClient;
  private axiosInstance: AxiosInstance;

  private constructor() {
    const baseURL = process.env.NEXT_PUBLIC_SERVER_URL;

    if (!baseURL) {
      throw new Error("NEXT_PUBLIC_SERVER_URL is required for api-client");
    }

    this.axiosInstance = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // 請求攔截器
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // 在發送請求之前做些什麼
        // 例如，添加授權標頭

        const token =
          cookies().get("payload-token")?.value ||
          cookies().get("auth-token")?.value;
        if (token) {
          config.headers["Authorization"] = `JWT ${token}`;
          config.headers["Cookie"] = `payload-token=${token}; auth-token=${token}`;
        }
        return config;
      },
      (error) => {
        // 處理請求錯誤
        return Promise.reject(error);
      }
    );

    // 回應攔截器
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // 任何在 2xx 範圍內的狀態碼都會觸發此函數
        // 對回應數據做些什麼
        return response;
      },
      (error) => {
        console.log(error);
        // 任何超出 2xx 範圍的狀態碼都會觸發此函數
        // 對回應錯誤做些什麼
        if (error.response.status === 401) {
          // 處理未授權錯誤
          // 例如，重定向到登入頁面
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  // 通用 GET 請求
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.get(
      url,
      config
    );
    return response.data;
  }

  // 通用 POST 請求
  public async post<T>(
    url: string,
    data?: Record<string, string | number | boolean | string[] | JSON>,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.post(
      url,
      data,
      config
    );
    return response.data;
  }

  // 通用 PUT 請求
  public async put<T>(
    url: string,
    data?: Record<string, string>,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.put(
      url,
      data,
      config
    );
    return response.data;
  }

  // 通用 DELETE 請求
  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.delete(
      url,
      config
    );
    return response.data;
  }
}

export default ApiClient.getInstance();
