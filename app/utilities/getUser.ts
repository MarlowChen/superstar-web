import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getMockUser,
  isMockAuthEnabled,
  MOCK_AUTH_TOKEN,
  pickUsableAuthToken,
} from "@/app/lib/mockAuth";
import type { User } from "../../payload-types";

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const debugAuth = process.env.NEXT_PUBLIC_DEBUG_AUTH === "true";

export const getMeUser = async (args?: {
  nullUserRedirect?: string;
  validUserRedirect?: string;
  callbackUrl?: string;  // 🔥 新增
}): Promise<{
  user: User | null;
  token: string | undefined;
}> => {
  const { nullUserRedirect, validUserRedirect, callbackUrl } = args || {};
  const cookieStore = cookies();
  const token = pickUsableAuthToken(
    cookieStore.get("payload-token")?.value,
    cookieStore.get("auth-token")?.value
  );

  if (!token && isMockAuthEnabled()) {
    const user = getMockUser();

    if (validUserRedirect) {
      redirect(validUserRedirect);
    }

    return { user, token: MOCK_AUTH_TOKEN };
  }

  if (!token) {
    if (nullUserRedirect) {
      const url = callbackUrl
        ? `${nullUserRedirect}?callbackUrl=${encodeURIComponent(callbackUrl)}`
        : nullUserRedirect;
      redirect(url);
    }

    return { user: null, token };
  }

  if (isMockAuthEnabled() && token === MOCK_AUTH_TOKEN) {
    const user = getMockUser();

    if (validUserRedirect) {
      redirect(validUserRedirect);
    }

    return { user, token };
  }

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expirationTime = payload.exp * 1000;
      if (debugAuth) {
        console.info("getMeUser: token expiry check", {
          expiresAt: new Date(expirationTime).toISOString(),
          isNearExpiry: Date.now() > expirationTime - REFRESH_THRESHOLD_MS,
        });
      }
      if (Date.now() > expirationTime - REFRESH_THRESHOLD_MS) {
        if (debugAuth) {
          console.info("getMeUser: refresh token");
        }
        await refreshToken(token);
      }
    } catch (e) {
      console.error("Error parsing token:", e);
    }
  }

  const meUserReq = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `payload-token=${token}; auth-token=${token}`,
      },
    }
  );

  let parsedBody: { user?: User } | null = null;

  try {
    parsedBody = await meUserReq.json();
  } catch (error) {
    console.error("🔐 getMeUser:failed-to-parse-me-response", error);
  }

  const user = parsedBody?.user;

  if (validUserRedirect && meUserReq.ok && user) {
    redirect(validUserRedirect);
  }

  if (nullUserRedirect && (!meUserReq.ok || !user)) {
    const url = callbackUrl
      ? `${nullUserRedirect}?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : nullUserRedirect;
    redirect(url);
  }

  return { user: user ?? null, token };
};

async function refreshToken(
  token: string
): Promise<{ refreshedToken: string; exp: number } | null> {
  try {
    if (debugAuth) {
      console.info("refreshToken: start");
    }
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/refresh-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Cookie: `payload-token=${token}; auth-token=${token}`,
        },
      }
    );

    if (!res.ok) throw new Error("Failed to refresh token");

    const data = await res.json();
    if (debugAuth) {
      console.info("refreshToken: success");
    }
    return { refreshedToken: data.refreshedToken, exp: data.exp };
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}
