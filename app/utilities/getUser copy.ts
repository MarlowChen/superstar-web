import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { User } from "../../payload-types";

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiration

export const getMeUser = async (args?: {
  nullUserRedirect?: string;
  validUserRedirect?: string;
}): Promise<{
  user: User;
  token: string | undefined;
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {};
  const cookieStore = cookies();
  const token = cookieStore.get("payload-token")?.value;

  // 🔥 取得當前頁面路徑
  const headersList = headers();
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "";

  // 檢查是否需要刷新 token
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expirationTime = payload.exp * 1000;
      if (Date.now() > expirationTime - REFRESH_THRESHOLD_MS) {
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
        Authorization: `JWT ${token}`,
      },
    }
  ); console.log("api url", `${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/me`);

  console.log("meUserReq", meUserReq);


  const { user }: { user: User } = await meUserReq.json();

  if (validUserRedirect && meUserReq.ok && user) {
    redirect(validUserRedirect);
  }

  // 🔥 未登入時，帶上 callbackUrl
  if (nullUserRedirect && (!meUserReq.ok || !user)) {
    const callbackUrl = pathname || "/";
    const redirectUrl = `${nullUserRedirect}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    redirect(redirectUrl);
  }

  console.log("user", user);

  return { user, token };
};

async function refreshToken(
  token: string
): Promise<{ refreshedToken: string; exp: number } | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/refresh-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${token}`,
        },
      }
    );

    if (!res.ok) throw new Error("Failed to refresh token");

    const data = await res.json();
    return { refreshedToken: data.refreshedToken, exp: data.exp };
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}