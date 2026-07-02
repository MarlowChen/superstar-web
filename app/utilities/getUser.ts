import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "../../payload-types";

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

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
  const token =
    cookieStore.get("payload-token")?.value ||
    cookieStore.get("auth-token")?.value;
  if (!token) {
    if (nullUserRedirect) {
      const url = callbackUrl
        ? `${nullUserRedirect}?callbackUrl=${encodeURIComponent(callbackUrl)}`
        : nullUserRedirect;
      redirect(url);
    }

    return { user: null, token };
  }

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expirationTime = payload.exp * 1000;
      console.log("🔐 getMeUser:token-meta", {
        exp: payload.exp,
        expiresAt: new Date(expirationTime).toISOString(),
        isNearExpiry: Date.now() > expirationTime - REFRESH_THRESHOLD_MS,
      });
      if (Date.now() > expirationTime - REFRESH_THRESHOLD_MS) {
        console.log("🔐 getMeUser:refresh-token");
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
    console.log("🔐 refreshToken:start");
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
    console.log("🔐 refreshToken:success", {
      exp: data.exp,
    });
    return { refreshedToken: data.refreshedToken, exp: data.exp };
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}
