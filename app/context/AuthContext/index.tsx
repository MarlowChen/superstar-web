"use client";

// 修改 AuthContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { LoraModel, User, UserPoint } from "@/payload-types";
import { showToast } from "../../components/CustomToast";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Style } from "@/app/services/styleSwitcherApi";

// 新增使用者設定類型
export interface UserSettings {
  id?: string;
  user?: string;
  language: string;
  theme: string;
  displayLanguage?: string;
  displayTheme?: string;
  selectLoraModel?: LoraModel;
  selectStyle?: Style | null; // 新增風格設定
}

export interface Conversation {
  id: string;
  title: string;
  is_favorite: boolean;
  status: string;
  metadata: JSON;
  lastMessageAt: Date;
}

interface AuthContextType {
  user: User | null;
  userPoint: UserPoint | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  point: number;
  login: (
    email: string,
    password: string,
    callbackUrl?: string
  ) => Promise<User>;
  register: (params: {
    email: string;
    password: string;
    confirmPassword: string;
    name?: string;
    username?: string;
  }) => Promise<User>;
  checkAuthStatus: () => Promise<User | null>;
  updateUserPoint: () => Promise<UserPoint | null>;
  logout: () => Promise<void>;
  authenticatedRequest: (
    url: string,
    options?: RequestInit
  ) => Promise<Response | null>;
  // 新增設定相關方法
  userSettings: UserSettings | null;
  getUserSettings: () => Promise<void>;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  updateLanguage: (language: string) => Promise<void>;
  updateLoraModel: (loraModel: string) => Promise<void>;
  updateStyle: (styleId: string) => Promise<void>; // 新增風格更新方法
  updateTheme: (theme: string) => Promise<void>;
  updateProfile: (profile: {
    name?: string;
    username?: string;
    bio?: string;
    avatar?: string | null;
  }) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeAuthUser = (value: User | null | undefined): User | null => {
  if (!value) return null;

  const record = value as User & {
    id?: string;
    _id?: string;
    userId?: string;
  };
  const id = String(record.id || record._id || record.userId || "").trim();

  return id ? ({ ...value, id } as User) : value;
};

// 預設設定
const DEFAULT_SETTINGS: UserSettings = {
  language: "DEFAULT",
  theme: "DARK",
  displayLanguage: "Auto",
  displayTheme: "Dark",
};

const getCurrentCallbackUrl = (fallbackPath: string) => {
  if (typeof window === "undefined") {
    return fallbackPath;
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  initialUser: User | null;
}> = ({ children, initialUser }) => {
  const lng = useLocale();
  const t = useTranslations("authcontext");
  const router = useRouter();
  const pathname = usePathname();
  const isRedirectingToLoginRef = useRef(false);
  const hasCheckedAuthRef = useRef(false);
  const authRouteRef = useRef({
    lng,
    pathname,
    sessionExpiredMessage: t("Session_expired"),
  });
  const [user, setUserState] = useState<User | null>(() => normalizeAuthUser(initialUser));
  const [loading, setLoading] = useState(true);
  const [point, setPoint] = useState<number>(0);
  const [userPoint, setUserPoint] = useState<UserPoint | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const userId = user?.id;

  const setUser = useCallback((nextUser: User | null) => {
    setUserState(normalizeAuthUser(nextUser));
  }, []);

  useEffect(() => {
    authRouteRef.current = {
      lng,
      pathname,
      sessionExpiredMessage: t("Session_expired"),
    };
  }, [lng, pathname, t]);

  const authenticatedRequest = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (isRedirectingToLoginRef.current) {
        return null;
      }

      try {
        const response = await fetch(url, {
          ...options,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
        });

        // 處理認證錯誤
        if (response.status === 401) {
          if (!isRedirectingToLoginRef.current) {
            const {
              lng: currentLng,
              pathname: currentPathname,
              sessionExpiredMessage,
            } = authRouteRef.current;
            isRedirectingToLoginRef.current = true;
            setUser(null);
            showToast(sessionExpiredMessage, true);

            const fallbackCallbackUrl =
              currentPathname && currentPathname !== `/${currentLng}/login`
                ? currentPathname
                : `/${currentLng}/drawing`;
            const callbackUrl = getCurrentCallbackUrl(fallbackCallbackUrl);
            router.replace(
              `/${currentLng}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
            );
          }
          return null;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("status: 400")) {
          console.error("Request failed:", error);
        }
        throw error;
      }
    },
    [router, setUser]
  );

  const updateUserPoint = useCallback(async () => {
    if (!userId) {
      return null;
    }
    try {
      const url = "/api/user/point";
      const response = await authenticatedRequest(url);

      if (response) {
        const data = await response.json();
        if (data) {
          setPoint(Number(data.points ?? 0));
          setUserPoint(data);
          return data as UserPoint;
        }
      }
    } catch (error) {
      // console.error(t("failed_to_fetch_points"), error);
    }
    return null;
  }, [authenticatedRequest, userId]);

  // 獲取使用者設定
  const getUserSettings = useCallback(async () => {
    if (!userId) return;

    try {
      const url = `/api/user/settings?locale=${encodeURIComponent(lng)}`;
      const response = await authenticatedRequest(url);
      if (response) {
        const data = await response.json();
        setUserSettings(data);
      }
          } catch (error) {
        console.error("Failed to fetch user settings", error);
        // 如果失敗，使用預設設定
        setUserSettings(DEFAULT_SETTINGS);
      }
  }, [authenticatedRequest, lng, userId]);

  // 更新使用者設定
  const updateUserSettings = useCallback(
    async (settings: Partial<UserSettings>) => {
      if (!user) return;

      try {
        const url = "/api/user/settings";
        const response = await authenticatedRequest(url, {
          method: "POST",
          body: JSON.stringify(settings),
        });

        if (response) {
          const updatedSettings = await response.json();
          setUserSettings(updatedSettings);
        }
      } catch (error) {
        console.error(t("Failed to update user settings"), error);
        showToast(t("Failed to update settings"), true);
      }
    },
    [authenticatedRequest, user]
  );

  // 更新語言設定
  const updateLanguage = useCallback(
    async (language: string) => {
      if (!user) return;

      try {
        const url = "/api/user/settings/language";
        const response = await authenticatedRequest(url, {
          method: "PUT",
          body: JSON.stringify({ language }),
        });

        if (response) {
          const updatedSettings = await response.json();
          setUserSettings(updatedSettings);
        }
      } catch (error) {
        console.error(t("Failed to update language setting"), error);
        showToast(t("Failed to update language"), true);
      }
    },
    [authenticatedRequest, user]
  );

  // 更新 Lora 模型設定
  const updateLoraModel = useCallback(
    async (loraModel: string) => {
      if (!user) return;

      try {
        const url = "/api/user/settings/lora";
        const response = await authenticatedRequest(url, {
          method: "PUT",
          body: JSON.stringify({ loraModel, locale: lng }),
        });

        if (response) {
          const updatedSettings = await response.json();
          setUserSettings(updatedSettings);
        }
      } catch (error) {
        console.error(t("Failed to update lora setting"), error);
        showToast(t("Failed to update lora"), true);
      }
    },
    [authenticatedRequest, user]
  );

  // 新增：更新風格設定
  const updateStyle = useCallback(
    async (styleId: string) => {
      if (!user) return;

      try {
        const url = "/api/user/settings/style";
        const response = await authenticatedRequest(url, {
          method: "PUT",
          body: JSON.stringify({ styleId, locale: lng }),
        });

        if (response) {
          const updatedSettings = await response.json();
          setUserSettings(updatedSettings);
        }
      } catch (error) {
        console.error(t("Failed to update style setting"), error);
        showToast(t("Failed to update style"), true);
      }
    },
    [authenticatedRequest, user]
  );

  // 更新主題設定
  const updateTheme = useCallback(
    async (theme: string) => {
      if (!user) return;

      try {
        const url = "/api/user/settings/theme";
        const response = await authenticatedRequest(url, {
          method: "PUT",
          body: JSON.stringify({ theme }),
        });

        if (response) {
          const updatedSettings = await response.json();
          setUserSettings(updatedSettings);
        }
      } catch (error) {
        console.error(t("Failed to update theme setting"), error);
        showToast(t("Failed to update theme"), true);
      }
    },
    [authenticatedRequest, user]
  );

  const updateProfile = useCallback(
    async (profile: { name?: string; username?: string; bio?: string; avatar?: string | null }) => {
      if (!user) return null;

      try {
        const response = await authenticatedRequest("/api/user/profile", {
          method: "PUT",
          body: JSON.stringify(profile),
        });

        if (!response) return null;

        const data = await response.json();
        const updatedUser = (data?.user || null) as User | null;
        if (updatedUser) {
          setUser(updatedUser);
        }
        return updatedUser;
      } catch (error) {
        console.error("Failed to update profile", error);
        showToast(t("Failed to update profile"), true);
        return null;
      }
    },
    [authenticatedRequest, setUser, t, user]
  );

  const checkAuthStatus = useCallback(async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = response.ok ? await response.json() : null;

      const nextUser = data?.user ?? null;
      if (!nextUser) {
        setUser(null);
        return null;
      }

      setUser(nextUser);
      return nextUser;
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Failed to fetch user:", error);
      }
      setUser(null);
      return null;
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [setUser]);

  const login = useCallback(
    async (email: string, password: string, callbackUrl?: string) => {
      setLoading(true);
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, callbackUrl }),
          credentials: "include",
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.user) {
          throw new Error(
            data?.errors?.[0]?.message ||
              data?.error ||
              data?.message ||
              "登錄失敗"
          );
        }

        isRedirectingToLoginRef.current = false;
        setUser(data.user);
        return data.user as User;
      } finally {
        setLoading(false);
      }
    },
    [setUser]
  );

  const register = useCallback(
    async ({
      email,
      password,
      confirmPassword,
      name,
      username,
    }: {
      email: string;
      password: string;
      confirmPassword: string;
      name?: string;
      username?: string;
    }) => {
      setLoading(true);
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            confirmPassword,
            name,
            username,
          }),
          credentials: "include",
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.errors?.[0]?.message ||
              data?.error ||
              data?.message ||
              "註冊失敗"
          );
        }

        if (data?.user) {
          isRedirectingToLoginRef.current = false;
          setUser(data.user);
          return data.user as User;
        }

        const loginResponse = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        });
        const loginData = await loginResponse.json().catch(() => null);

        if (!loginResponse.ok || !loginData?.user) {
          throw new Error(
            loginData?.errors?.[0]?.message ||
              loginData?.error ||
              loginData?.message ||
              "註冊成功但登入失敗"
          );
        }

        isRedirectingToLoginRef.current = false;
        setUser(loginData.user);
        return loginData.user as User;
      } finally {
        setLoading(false);
      }
    },
    [setUser]
  );

  const logout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      setUserPoint(null);
      setPoint(0);
      setUserSettings(null);
      isRedirectingToLoginRef.current = true;
      router.replace(`/${lng}/login`);
    } catch (error) {
      console.error("登出失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasCheckedAuthRef.current) {
      hasCheckedAuthRef.current = true;
      checkAuthStatus();
    }
  }, [checkAuthStatus]);

  useEffect(() => {
    if (!user) {
      setPoint(0);
      setUserPoint(null);
      setUserSettings(null);
      return;
    }

    if (isRedirectingToLoginRef.current) {
      isRedirectingToLoginRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (userId) {
      updateUserPoint();
    }
  }, [userId, updateUserPoint]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    let lastRefreshAt = 0;
    const refreshPoints = () => {
      const now = Date.now();
      if (now - lastRefreshAt < 800) return;
      lastRefreshAt = now;
      void updateUserPoint();
    };
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        refreshPoints();
      }
    };
    const events = [
      "aierone:points-refresh",
      "points:refresh",
      "refreshUserPoint",
      "generation:submitted",
      "generation:completed",
      "payment:success",
      "subscription:updated",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, refreshPoints);
    });
    window.addEventListener("focus", refreshPoints);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, refreshPoints);
      });
      window.removeEventListener("focus", refreshPoints);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [updateUserPoint, userId]);

  // 當使用者登入後獲取設定
  useEffect(() => {
    if (userId) {
      getUserSettings();
    }
  }, [userId, getUserSettings]);

  return (
    <AuthContext.Provider
      value={{
        user,
        userPoint,
        setUser,
        loading,
        point,
        login,
        register,
        checkAuthStatus,
        updateUserPoint,
        logout,
        authenticatedRequest,
        userSettings,
        getUserSettings,
        updateUserSettings,
        updateLanguage,
        updateLoraModel,
        updateStyle, // 新增風格更新方法
        updateTheme,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
