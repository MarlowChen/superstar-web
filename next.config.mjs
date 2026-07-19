import dotenv from "dotenv";
import ContentSecurityPolicy from "./csp.mjs";
import getRedirects from "./redirects.mjs";
import createNextIntlPlugin from 'next-intl/plugin'; // 新增

dotenv.config();

// 創建 next-intl 插件
const withNextIntl = createNextIntlPlugin('./app/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "*.access.glows.ai",
        pathname: "/view/**",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn2.stablediffusionapi.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "musicfile.kie.ai",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "atlas-media.oss-us-west-1.aliyuncs.com",
        pathname: "/**",
      },
    ],
    domains: [
      process.env.NEXT_PUBLIC_SERVER_URL,
      process.env.NEXT_PUBLIC_URL,
      "nyc3.digitaloceanspaces.com",
      "aierone.nyc3.cdn.digitaloceanspaces.com",
      "aierone.nyc3.digitaloceanspaces.com",
      "tw-01.sgw.glows.ai",
      "tempfile.aiquickdraw.com"
    ]
      .filter(Boolean)
      .map((url) => url.replace(/https?:\/\//, "")),
  },
  async rewrites() {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;

    if (!serverUrl) {
      return [];
    }

    return [
      {
        source: "/media/:shortId",
        destination: `${serverUrl}/media/:shortId`,
      },
    ];
  },
  redirects: getRedirects,
  async headers() {
    const headers = [];

    // if (!process.env.NEXT_PUBLIC_IS_LIVE) {
    //   headers.push({
    //     headers: [
    //       {
    //         key: "X-Robots-Tag",
    //         value: "noindex",
    //       },
    //     ],
    //     source: "/:path*",
    //   });
    // }

    headers.push({
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: ContentSecurityPolicy,
        },
      ],
    });

    return headers;
  },
  output: "standalone",
  
};

// 用 next-intl 插件包裝配置
export default withNextIntl(nextConfig);
