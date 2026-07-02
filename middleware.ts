// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['en', 'zh-TW', 'ja'],
  defaultLocale: 'en',
  
  // 🔧 重要：確保路徑前綴配置
  localePrefix: 'always', // 強制顯示語言前綴
  localeDetection: true,
  
  // 🔧 處理不同的路徑模式
  alternateLinks: false, // 避免自動添加 alternate links
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 🔍 詳細調試信息
  console.log('🚀 Middleware Debug:', {
    url: request.url,
    pathname: pathname,
    method: request.method,
    locale: request.nextUrl.locale,
    searchParams: request.nextUrl.searchParams.toString(),
    headers: {
      'accept-language': request.headers.get('accept-language'),
      'cookie': request.headers.get('cookie'),
      'x-pathname': request.headers.get('x-pathname')
    }
  });

  // 🔧 處理短網址路徑 - 直接通過，不進行國際化處理
  // 支持多種短網址模式：/media/, /s/, /link/ 等
  const shortUrlPatterns = ['/media/', '/s/', '/link/', '/go/'];
  const isShortUrl = shortUrlPatterns.some(pattern => pathname.startsWith(pattern));
  
  if (isShortUrl) {
    console.log('📎 Short URL detected, bypassing i18n:', pathname);
    return NextResponse.next();
  }

  // 🔧 處理 API 路由和靜態文件
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/_vercel/') ||
    pathname.includes('.')
  ) {
    console.log('🚫 Skipping middleware for:', pathname);
    return NextResponse.next();
  }

  // 🔧 檢查路徑是否已包含語言前綴
  const hasLocalePrefix = /^\/(?:en|zh-TW|ja)(?:\/|$)/.test(pathname);
  console.log('🔍 Has locale prefix:', hasLocalePrefix, 'for path:', pathname);

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