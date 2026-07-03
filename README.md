# 超星 AI 平台前端

這是超星 AI 平台的 Next.js 前端。主要提供 AI 圖片、影片、對嘴、模板與創作工作台入口，前端透過本機 `/api/*` route proxy 串接後端 API，並用 `payload-token` / `auth-token` httpOnly cookie 維持登入狀態。

## 目前需求重點

需求書中的第一階段功能包含：

- 生成式文案：貼文、文案、腳本、靈感對話。
- 圖片與影片生成：文生圖、圖生圖、文生影片、圖生影片。
- 人物與聲音：對嘴影片、人物換置、多角度圖、AI 聲音生成、換臉。
- 待補功能：爆款/保健類分析、剪輯、AI 上字幕。
- 使用者系統：購買點數、前台查看可用點數。

本前端目前先確保首頁、登入註冊、工作台入口與 RWD 可正常使用，再逐步補齊需求書中的創作功能與點數/付費流程。

## 本地開發

```bash
npm install
npm run dev
```

開啟 [http://localhost:3000/zh-TW](http://localhost:3000/zh-TW)。

`npm run dev` 固定使用 port `3000`。若畫面出現 Next server error 或 hot reload 卡住，先停止 dev server 後重新啟動；必要時再清除 `.next` 快取。

## 環境變數

先複製 `.env.example` 成 `.env.local`，再依環境調整：

```bash
NEXT_PUBLIC_SERVER_URL=https://api.superstar-ai.xyz
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_IS_MOCK=false
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
NEXT_PUBLIC_DEBUG_MIDDLEWARE=false
NEXT_PUBLIC_DEBUG_I18N=false
NEXT_PUBLIC_DEBUG_REDIRECTS=false
NEXT_PUBLIC_DEBUG_AUTH=false
```

注意：debug 旗標預設關閉，避免 middleware 或 i18n loader 把過多 request 資訊打進 log。

### 本機 mock 登入與 UI QA

若只想檢查登入後工作台、模板列表與 RWD，而不想建立真實帳號，可以暫時開啟 mock：

```bash
NEXT_PUBLIC_IS_MOCK=true NEXT_PUBLIC_URL=http://localhost:3001 npx next dev -p 3001
```

mock 模式只在非 production 生效，會提供本機假使用者、點數、空對話列表、基本模型能力、範本資料、作品庫與收藏範例；它不會真的產生圖片或影片。mock 登入不會寫正式 `payload-token` / `auth-token` cookie，避免同時開 `localhost:3000` 和 `localhost:3001` 時互相污染登入狀態。正式串後端時請維持 `NEXT_PUBLIC_IS_MOCK=false`。

不要在同一個專案目錄同時跑 `next dev` 和 `next build`，兩者都會寫 `.next`，可能造成 dev server 暫時出現 missing chunk error；重新啟動 dev server 即可恢復。

## 驗證

```bash
npm run lint
npx tsc --noEmit
npm run build
```

目前 lint 仍有既有 warning，主要集中在 React hook dependencies 與部分 `<img>` 使用；build 可通過。

## 部署

專案使用 Next.js `output: "standalone"`，production 啟動點是 `server.js`：

```bash
npm run build
npm start
```

`server.js` 會讀取 `PORT`，production 預設用 HTTP server，適合讓 Cloud Run、反向代理或平台層處理 HTTPS。開發用 HTTPS 可執行：

```bash
npm run dev:https
```

但這需要本機存在 `certificates/localhost+2-key.pem` 與 `certificates/localhost+2.pem`。

## 常見問題

- 未登入進首頁點「開始創作」會導到 `/zh-TW/login?callbackUrl=%2Fzh-TW%2Fdrawing`。
- 登入與註冊都會走本機 `/api/auth/*` route，再由前端 server 轉送到 `NEXT_PUBLIC_SERVER_URL`。
- 註冊成功但後端沒有直接回 token/user 時，前端 route 會自動再呼叫 password login，成功後寫入 cookie。
- 若後端沒有 `/api/redirects`，build 會安靜 fallback 到基本 IE redirect，不阻塞部署。
