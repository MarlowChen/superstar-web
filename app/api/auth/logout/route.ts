import { NextResponse } from "next/server";

function clearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export async function POST() {
  const response = NextResponse.json({ success: true });
  const options = clearCookieOptions();

  response.cookies.set("payload-token", "", options);
  response.cookies.set("auth-token", "", options);

  return response;
}
