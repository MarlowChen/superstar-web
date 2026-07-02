import React from "react";
import { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from "./components/ThemeProvider";
import { getTheme } from "./actions/theme";
import "./globals.css";
import Script from "next/script";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const storedTheme = await getTheme();
  const initialTheme = storedTheme ?? "dark";
  const isDark = initialTheme === "dark";

  return (
    <html lang={locale} className={isDark ? "dark" : undefined} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" sizes="32x32" />
        <meta property="fb:app_id" content="571449555549847" />
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function() {
            try {
              var storedTheme = localStorage.getItem('theme');
              var cookieTheme = document.cookie
                .split('; ')
                .find(function(cookie) { return cookie.indexOf('theme=') === 0; });
              var cookieValue = cookieTheme ? cookieTheme.split('=')[1] : null;
              var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              var resolvedTheme =
                storedTheme === 'light' || storedTheme === 'dark'
                  ? storedTheme
                  : cookieValue === 'light' || cookieValue === 'dark'
                    ? cookieValue
                    : systemDark
                      ? 'dark'
                      : 'light';

              document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
              document.body.classList.toggle('dark', resolvedTheme === 'dark');
              document.body.style.backgroundColor = resolvedTheme === 'dark' ? '#09111B' : '#F2F7FC';
              document.body.style.color = resolvedTheme === 'dark' ? '#E7F1FB' : '#10243A';
            } catch (e) {}
          })();
        `}</Script>
      </head>
      <body className={isDark ? "dark" : undefined} style={{ backgroundColor: isDark ? "#09111B" : "#F2F7FC", color: isDark ? "#E7F1FB" : "#10243A" }}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
        </NextIntlClientProvider>
        
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=G-XE9HTP1H7B`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XE9HTP1H7B');
          `}
        </Script>
      </body>
    </html>
  );
}

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_SERVER_URL ||
      "https://test.aierone.com"
  ),
  title: {
    default: "超星AI平台",
    template: "%s | 超星AI平台",
  },
  applicationName: "超星AI平台",
  twitter: {
    card: "summary_large_image",
    title: "超星AI平台",
  },
  openGraph: {
    title: "超星AI平台",
    siteName: "超星AI平台",
  },
};
