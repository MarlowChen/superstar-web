const policies = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://maps.googleapis.com",
    "https://accounts.google.com",
    "https://www.google.com",
    "https://www.gstatic.com",
    "https://www.googletagmanager.com",
    "https://connect.facebook.net",
    "https://static.xx.fbcdn.net",
    "https://www.youtube.com",
    "https://s.ytimg.com",
    "https://googleads.g.doubleclick.net", // 補：YouTube 廣告腳本常需要
  ],
  "script-src-elem": [
    "'self'",
    "'unsafe-inline'",
    "https://maps.googleapis.com",
    "https://accounts.google.com",
    "https://www.google.com",
    "https://www.gstatic.com",
    "https://www.googletagmanager.com",
    "https://connect.facebook.net",
    "https://www.youtube.com",
    "https://s.ytimg.com",
    "https://googleads.g.doubleclick.net", // 補：同上
  ],
  "child-src": ["'self'", "blob:"],
  "worker-src": ["'self'", "blob:"],
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://accounts.google.com",
    "https://www.gstatic.com",
  ],
  "img-src": [
    "'self'",
    "https://aierone.fly.dev",
    "https://aierone.com",
    "https://superstar-ai.xyz",
    "https://api.superstar-ai.xyz",
    "https://aierone-api-3ewyr5bvoa-de.a.run.app",
    "https://aierone-73arn5nlpa-uc.a.run.app",
    "https://tempfile.aiquickdraw.com",
    "https://raw.githubusercontent.com",
    "https://nyc3.digitaloceanspaces.com",
    "https://aierone.nyc3.cdn.digitaloceanspaces.com",
    "https://aierone.nyc3.digitaloceanspaces.com",
    "https://*.r2.dev",
    "https://cdn2.stablediffusionapi.com",
    "https://openrouter.ai",
    "https://www.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://static.xx.fbcdn.net",
    "https://i.ytimg.com",
    "https://img.youtube.com",
    "https://*.googleusercontent.com", // ★ 重要補漏：Google 登入後的使用者頭像
    "blob:",
    "data:",
  ],
  "media-src": [
    "'self'",
    "blob:",
    "data:",
    "https://tempfile.aiquickdraw.com",
    "https://api.superstar-ai.xyz",
    "https://aierone-api-3ewyr5bvoa-de.a.run.app",
    "https://superstar-ai.xyz",
    "https://nyc3.digitaloceanspaces.com",
    "https://aierone.nyc3.cdn.digitaloceanspaces.com",
    "https://aierone.nyc3.digitaloceanspaces.com",
    "https://*.r2.dev",
    "https://cdn2.stablediffusionapi.com",
    "https://openrouter.ai",
  ],
  "font-src": [
    "'self'",
    "https://fonts.gstatic.com",
  ],
  "frame-src": [
    "'self'",
    "https://accounts.google.com",
    "https://superstar-ai.xyz",
    "https://api.superstar-ai.xyz",
    "https://www.google.com",
    "https://www.facebook.com",
    "https://www.youtube.com",
    "https://youtube.com",
    "https://www.youtube-nocookie.com", // 補：增強 YouTube 相容性
    "https://googleads.g.doubleclick.net", // 補：部分嵌入式播放器需要
  ],
  "connect-src": [
    "'self'",
    "https://maps.googleapis.com",
    "https://aierone.fly.dev:3000",
    "https://aierone.fly.dev",
    "https://aierone-73arn5nlpa-uc.a.run.app",
    "https://recaptchaenterprise.googleapis.com",
    "https://aierone-admin-376148829821.asia-east1.run.app",
    "https://api.aierone.com",
    "https://aierone-api-3ewyr5bvoa-de.a.run.app",
    "https://api.superstar-ai.xyz",
    "https://superstar-ai.xyz",
    "https://tempfile.aiquickdraw.com",
    "https://nyc3.digitaloceanspaces.com",
    "https://aierone.nyc3.cdn.digitaloceanspaces.com",
    "https://aierone.nyc3.digitaloceanspaces.com",
    "https://*.r2.dev",
    "https://cdn2.stablediffusionapi.com",
    "https://openrouter.ai",
    "https://www.google-analytics.com",
    "https://analytics.google.com",
    "https://www.google.com",
    "https://www.googletagmanager.com",
    "https://region1.google-analytics.com",
    "https://graph.facebook.com",
    "https://connect.facebook.net",
    "https://www.youtube.com",
    "https://googleads.g.doubleclick.net",
    "data:",
  ],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'", "https://superstar-ai.xyz", "https://api.superstar-ai.xyz"],
  "frame-ancestors": ["'none'"], 
  "upgrade-insecure-requests": [],
};

const ContentSecurityPolicy = Object.entries(policies)
  .map(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return key;
      }
      return `${key} ${value.join(" ")}`;
    }
    return "";
  })
  .filter(Boolean)
  .join("; ");

export default ContentSecurityPolicy;
