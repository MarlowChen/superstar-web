import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isMockAuthEnabled,
  MOCK_BILLING_STATUS,
  MOCK_USER_POINT,
  pickUsableAuthToken,
} from "@/app/lib/mockAuth";

type RouteContext = {
  params: {
    path: string[];
  };
};

const allowedBillingPaths = new Set([
  "user-orders",
  "user-status",
  "cancel-subscription",
  "stripe-receipt-url",
  "order-preview",
  "create-checkout",
  "upgrade-subscription",
  "downgrade-subscription",
]);

async function createMockBillingResponse(req: NextRequest, forwardedPath: string) {
  if (forwardedPath === "user-status") {
    return NextResponse.json(MOCK_BILLING_STATUS);
  }

  if (forwardedPath === "user-orders") {
    return NextResponse.json({ orders: [], total: 0 });
  }

  if (forwardedPath === "stripe-receipt-url") {
    return NextResponse.json({ url: null });
  }

  if (forwardedPath === "cancel-subscription") {
    return NextResponse.json({ success: true, message: "Mock subscription cancelled" });
  }

  if (forwardedPath === "upgrade-subscription" || forwardedPath === "downgrade-subscription") {
    return NextResponse.json({ success: true, mode: "mock" });
  }

  if (forwardedPath === "order-preview") {
    const transactionType =
      req.nextUrl.searchParams.get("transactionType")?.toUpperCase() || "PLUS_YEAR";
    const locale = req.nextUrl.searchParams.get("locale") || "zh";
    const isYearly = transactionType.endsWith("_YEAR");
    const plan = transactionType.replace(/_YEAR$/, "");
    const pointsByPlan: Record<string, number> = {
      PLUS: 1000,
      PRO: 4000,
      MAX: 10000,
      PAYG: 1000,
    };
    const monthlyPrices: Record<string, string> = {
      PLUS: "NT$299",
      PRO: "NT$799",
      MAX: "NT$1,999",
      PAYG: "NT$300",
    };
    const yearlyPrices: Record<string, string> = {
      PLUS: "NT$2,870",
      PRO: "NT$7,670",
      MAX: "NT$19,190",
    };
    const added = pointsByPlan[plan] || pointsByPlan.PLUS;
    const displayAmount =
      isYearly && yearlyPrices[plan] ? yearlyPrices[plan] : monthlyPrices[plan] || monthlyPrices.PLUS;

    return NextResponse.json({
      transactionType,
      locale,
      title: `Mock ${plan} ${isYearly ? "Yearly" : "Monthly"}`,
      displayAmount,
      subscriptionInfo:
        plan === "PAYG"
          ? undefined
          : {
              billingCycle: isYearly ? "yearly" : "monthly",
              description: isYearly ? "本機測試年訂閱" : "本機測試月訂閱",
            },
      purchaseInfo:
        plan === "PAYG"
          ? {
              description: "本機測試點數包",
            }
          : undefined,
      pointsChange: {
        before: MOCK_USER_POINT.points,
        after: MOCK_USER_POINT.points + added,
        added,
        description: `本機測試將增加 ${added.toLocaleString()} 點`,
      },
      statusChange: `FREE -> ${plan}`,
      paymentMethod: {
        displayText: "本機測試付款",
      },
      sessionId: `mock-${transactionType.toLowerCase()}`,
    });
  }

  if (forwardedPath === "create-checkout") {
    return NextResponse.json({
      mode: "mock",
      url: `${req.nextUrl.origin}/zh-TW?checkout=mock-success`,
    });
  }

  return NextResponse.json({ error: "Mock billing route not found" }, { status: 404 });
}

async function proxyBillingRequest(req: NextRequest, context: RouteContext) {
  const forwardedPath = context.params.path.join("/");

  if (!allowedBillingPaths.has(forwardedPath)) {
    return NextResponse.json({ error: "Billing route not found" }, { status: 404 });
  }

  if (isMockAuthEnabled()) {
    return createMockBillingResponse(req, forwardedPath);
  }

  const cookieStore = cookies();
  const token = pickUsableAuthToken(
    cookieStore.get("payload-token")?.value,
    cookieStore.get("auth-token")?.value
  );

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SERVER_URL is required" },
      { status: 500 }
    );
  }

  const targetUrl = new URL(`/${forwardedPath}`, backendUrl);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const accept = req.headers.get("accept");

  if (contentType) headers.set("Content-Type", contentType);
  if (accept) headers.set("Accept", accept);

  headers.set("Authorization", `JWT ${token}`);
  headers.set("Cookie", `payload-token=${token}; auth-token=${token}`);

  const method = req.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  try {
    const response = await fetch(targetUrl, init);
    const body = await response.text();
    const responseContentType =
      response.headers.get("content-type") || "application/json";

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": responseContentType,
      },
    });
  } catch (error) {
    console.error("[api/billing] backend proxy failed", error);
    return NextResponse.json(
      {
        error: "Backend proxy failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}

export function GET(req: NextRequest, context: RouteContext) {
  return proxyBillingRequest(req, context);
}

export function POST(req: NextRequest, context: RouteContext) {
  return proxyBillingRequest(req, context);
}
