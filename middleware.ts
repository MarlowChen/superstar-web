// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { isMockAuthToken, isMockAuthEnabled, pickUsableAuthToken } from './app/lib/mockAuth';

const intlMiddleware = createMiddleware({
  locales: ['en', 'zh-TW', 'ja'],
  defaultLocale: 'en',
  
  // 🔧 重要：確保路徑前綴配置
  localePrefix: 'always', // 強制顯示語言前綴
  localeDetection: true,
  
  // 🔧 處理不同的路徑模式
  alternateLinks: false, // 避免自動添加 alternate links
});

const debugMiddleware = process.env.NEXT_PUBLIC_DEBUG_MIDDLEWARE === 'true';
const localePathPattern = /^\/(en|zh-TW|ja)(\/.*)?$/;
const protectedRoutePrefixes = [
  '/collecting',
  '/drawing',
  '/edited',
  '/library',
  '/models',
  '/recents',
  '/templates',
];

const normalizePath = (value: string) =>
  value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value;

const isLocalMockPreviewRequest = (request: NextRequest) =>
  process.env.NODE_ENV !== 'production' &&
  request.nextUrl.hostname === 'localhost' &&
  request.nextUrl.port === '3001';

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🔧 處理短網址路徑 - 直接通過，不進行國際化處理
  // 支持多種短網址模式：/media/, /s/, /link/ 等
  const shortUrlPatterns = ['/media/', '/s/', '/link/', '/go/'];
  const isShortUrl = shortUrlPatterns.some(pattern => pathname.startsWith(pattern));
  
  if (isShortUrl) {
    if (debugMiddleware) {
      console.info('Middleware: short URL bypass', { pathname });
    }
    return NextResponse.next();
  }

  // 🔧 處理 API 路由和靜態文件
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/_vercel/') ||
    pathname.includes('.')
  ) {
    if (debugMiddleware) {
      console.info('Middleware: route bypass', { pathname });
    }
    return NextResponse.next();
  }

  // 🔧 檢查路徑是否已包含語言前綴
  const hasLocalePrefix = /^\/(?:en|zh-TW|ja)(?:\/|$)/.test(pathname);
  if (debugMiddleware) {
    console.info('Middleware: i18n route', {
      pathname,
      method: request.method,
      hasLocalePrefix,
      searchParams: request.nextUrl.searchParams.toString(),
    });
  }

  const localeMatch = pathname.match(localePathPattern);
  if (localeMatch) {
    const locale = localeMatch[1];
    const pathWithoutLocale = normalizePath(localeMatch[2] || '/');
    const isProtectedRoute = protectedRoutePrefixes.some(
      (prefix) => pathWithoutLocale === prefix || pathWithoutLocale.startsWith(`${prefix}/`)
    );
    const rawPayloadToken = request.cookies.get('payload-token')?.value;
    const rawAuthToken = request.cookies.get('auth-token')?.value;
    const authToken = pickUsableAuthToken(rawPayloadToken, rawAuthToken);
    const allowsLocalMockPreview =
      isMockAuthEnabled() || isLocalMockPreviewRequest(request);
    const hasStaleMockCookie =
      !allowsLocalMockPreview &&
      (isMockAuthToken(rawPayloadToken) || isMockAuthToken(rawAuthToken));
    const hasAuthCookie = Boolean(authToken);

    if (isProtectedRoute && !hasAuthCookie && !allowsLocalMockPreview) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = `/${locale}/login`;
      loginUrl.search = '';
      loginUrl.searchParams.set(
        'callbackUrl',
        `${pathname}${request.nextUrl.search}`
      );

      if (debugMiddleware) {
        console.info('Middleware: protected route redirect', {
          pathname,
          loginPath: loginUrl.pathname,
        });
      }

      const response = NextResponse.redirect(loginUrl);

      if (hasStaleMockCookie) {
        response.cookies.set('payload-token', '', { path: '/', maxAge: 0 });
        response.cookies.set('auth-token', '', { path: '/', maxAge: 0 });
      }

      return response;
    }
  }

  const response = intlMiddleware(request);
  
  // console.log('📤 Middleware Response:', {
  //   status: response.status,
  //   redirected: response.redirected,
  //   finalUrl: response.url,
  //   headers: Object.fromEntries(response.headers.entries())
  // });
  
  return response;
}

export const config = {
  matcher: [
    // 🔧 更精確的路徑匹配
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // 也可以嘗試這個更具體的匹配模式：
    // '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
};
