export const WATERMARK = {
  marginX: 54,
  marginY: 30,
  logoDrawSize: 60,
  textGap: 6,
  textOffsetY: 3,
  fontSize: 34,
};

const loadWatermarkLogo = () =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const logoImg = new Image();
    logoImg.onload = () => resolve(logoImg);
    logoImg.onerror = reject;
    logoImg.src = "/images/logo-small2.svg";
  });

const createWhiteLogo = (
  logoImg: HTMLImageElement,
  width: number,
  height: number
) => {
  const logoCanvas = document.createElement("canvas");
  logoCanvas.width = width;
  logoCanvas.height = height;

  const logoCtx = logoCanvas.getContext("2d");
  if (!logoCtx) return logoImg;

  logoCtx.drawImage(logoImg, 0, 0, width, height);
  logoCtx.globalCompositeOperation = "source-in";
  logoCtx.fillStyle = "#ffffff";
  logoCtx.fillRect(0, 0, width, height);

  return logoCanvas;
};

export const addWatermark = async (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
  const logoImg = await loadWatermarkLogo();
  const logoWidth = WATERMARK.logoDrawSize;
  const logoHeight = WATERMARK.logoDrawSize;
  const watermarkText = "superstar";

  ctx.font = `bold ${WATERMARK.fontSize}px Arial`;
  const textWidth = ctx.measureText(watermarkText).width || 150;
  const totalWidth = logoWidth + WATERMARK.textGap + textWidth;
  const x = Math.max(WATERMARK.marginX, width - totalWidth - WATERMARK.marginX);
  const y = height - logoHeight - WATERMARK.marginY;

  const whiteLogo = createWhiteLogo(logoImg, logoWidth, logoHeight);
  ctx.drawImage(whiteLogo, x, y, logoWidth, logoHeight);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(
    watermarkText,
    x + logoWidth + WATERMARK.textGap,
    y + logoHeight / 2 + WATERMARK.textOffsetY
  );
}; 
