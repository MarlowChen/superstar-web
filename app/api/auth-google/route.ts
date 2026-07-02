import { NextRequest, NextResponse } from "next/server";

const getPublicAppUrl = () => {
  const value = process.env.NEXT_PUBLIC_URL?.trim();

  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_URL for Google auth redirect");
  }

  return value.replace(/\/$/, "");
};

function decodeJwtExp(token: string): number | undefined {
  try {
    const [, payload] = token.split(".");
    if (!payload) return undefined;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof decoded?.exp === "number" ? decoded.exp : undefined;
  } catch {
    return undefined;
  }
}

function getCookieOptions(exp?: number) {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = exp ? Math.max(exp - now, 0) : undefined;

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
}

const normalizeCallbackUrl = (value: string | null, locale: string) => {
  const fallback = `/${locale}/drawing`;

  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith(`/${locale}/login`)) {
    return fallback;
  }

  return trimmed;
};

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const locale = req.nextUrl.searchParams.get("locale") || "en";
  const publicAppUrl = getPublicAppUrl();
  const callbackUrl = normalizeCallbackUrl(
    req.nextUrl.searchParams.get("callbackUrl"),
    locale
  );

  if (token) {
    const response = NextResponse.redirect(new URL(callbackUrl, publicAppUrl));
    const options = getCookieOptions(decodeJwtExp(token));

    response.cookies.set("payload-token", token, options);
    response.cookies.set("auth-token", token, options);

    return response;
  }

  return NextResponse.redirect(
    new URL(
      `/${locale}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      publicAppUrl
    )
  );
}
