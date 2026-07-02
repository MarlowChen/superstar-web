/* eslint-disable no-restricted-globals */
self.onmessage = async function (e) {
    const { action, id, key, dataURL, data } = e.data;
  
    try {
      // ------------------------------------------------------------
      // 1. 圖片處理 (既有的功能)
      // ------------------------------------------------------------
      if (!action || action === 'processImage') {
          const commaIndex = dataURL.indexOf(",");
          const header = dataURL.substring(0, commaIndex);
          const base64 = dataURL.substring(commaIndex + 1);
          const mime = header.match(/:(.*?);/)[1] || "image/png";
  
          const binaryString = self.atob(base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
  
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
  
          self.postMessage(
            { id, key, buffer: bytes.buffer, mime, success: true },
            [bytes.buffer]
          );
          return;
      }
  
      // ------------------------------------------------------------
      // 2. 🔥 新增：JSON 序列化與壓縮 (解決 saveSnapshotJSON 卡頓)
      // ------------------------------------------------------------
      if (action === 'compress') {
          // A. 序列化 (這步如果在主執行緒做會很卡)
          const jsonString = JSON.stringify(data);
  
          // B. 壓縮 (使用原生 API，無需 pako)
          // 'deflate' 是 gzip 的核心算法 (zlib 格式)
          const stream = new Blob([jsonString]).stream().pipeThrough(new CompressionStream('deflate'));
          const response = new Response(stream);
          const buffer = await response.arrayBuffer();
  
          // C. 回傳結果 (零拷貝)
          self.postMessage(
              { action: 'compress', buffer, success: true },
              [buffer]
          );
          return;
      }
  
    } catch (err) {
      self.postMessage({ id, key, action, error: String(err), success: false });
    }
  };