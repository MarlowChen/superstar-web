import { NextRequest, NextResponse } from "next/server";

const getPublicAppUrl = () => {
  const value = process.env.NEXT_PUBLIC_URL?.trim();

  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_URL for Google auth callback");
  }

  return value.replace(/\/$/, "");
};

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

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale") || "en";
  const callbackUrl = normalizeCallbackUrl(
    request.nextUrl.searchParams.get("callbackUrl"),
    locale
  );
  const publicAppUrl = getPublicAppUrl();

  const frontendCallbackUrl = new URL(
    "/api/auth-google",
    publicAppUrl
  );
  frontendCallbackUrl.searchParams.set("locale", locale);
  frontendCallbackUrl.searchParams.set("callbackUrl", callbackUrl);

  const target = new URL(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/auth/google-url`
  );
  target.searchParams.set(
    "callbackUrl",
    frontendCallbackUrl.toString()
  );

  const response = await fetch(target.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to initialize Google auth" },
      { status: response.status }
    );
  }

  const data = await response.json().catch(() => null);

  if (!data?.authUrl) {
    return NextResponse.json(
      { error: "Missing auth URL" },
      { status: 502 }
    );
  }

  return NextResponse.redirect(data.authUrl);
}
