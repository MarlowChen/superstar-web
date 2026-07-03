import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "../auth/utils";
import { isMockAuthEnabled } from "@/app/lib/mockAuth";

const LEGAL_TYPES = new Set(["terms", "privacy", "copyright", "refund", "cookie"]);
const LEGAL_LOCALES = new Set(["zh-TW", "en", "ja"]);

const emptyLegalResponse = () => NextResponse.json({ docs: [] });

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("where[type][equals]") || "";
  const locale = req.nextUrl.searchParams.get("where[locale][equals]") || "";

  if (!LEGAL_TYPES.has(type) || !LEGAL_LOCALES.has(locale)) {
    return emptyLegalResponse();
  }

  if (isMockAuthEnabled()) {
    return emptyLegalResponse();
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return emptyLegalResponse();
  }

  const targetUrl = new URL("/api/legal-terms", backendUrl);
  targetUrl.search = req.nextUrl.search;

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return emptyLegalResponse();
    }

    const data = await response.json().catch(() => ({ docs: [] }));
    return NextResponse.json(data || { docs: [] });
  } catch (error) {
    console.warn("Legal terms proxy fallback:", error);
    return emptyLegalResponse();
  }
}
