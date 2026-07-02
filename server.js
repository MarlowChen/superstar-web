const next = require('next');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 8080;

app.prepare().then(() => {
  let server;

  if (dev) {
    // 開發環境：使用 HTTPS
    const httpsOptions = {
      key: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost+2-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost+2.pem'))
    };

    server = https.createServer(httpsOptions, (req, res) => {
      handle(req, res);
    });
  } else {
    // 生產環境：使用 HTTP（Cloud Run 會處理 HTTPS）
    server = http.createServer((req, res) => {
      handle(req, res);
    });
  }

  server.listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> Ready on ${dev ? 'https' : 'http'}://localhost:${port}`);
  });
});