import React, { useRef, useEffect } from "react";
import { ThumbsUp } from "lucide-react";
import { CreateIcon } from "@/app/icon/CreateIcon";
import { useRouter } from "next/navigation";
import { ActionButton } from "../ActionButton";
import { useAuth } from "@/app/context/AuthContext";

interface ImageData {
  _id: string;
  publishedImage: {
    id: string;
    url: string;
    reactions: {
      likes: number;
      dislikes: number;
    };
    userReaction: {
      like: boolean;
      dislike: boolean;
      comment?: string;
    };
  };
  task: {
    id: string;
    loraModel: string;
    loraModelTitle: string;
    prompt: string;
  };
}

interface ImageCardProps {
  image: ImageData;
  onClick: () => void;
  handleReaction: (imageId: string, type: string) => void;
  onNewDrawing: (modelId: string) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({
  image,
  onClick,
  handleReaction,
  onNewDrawing,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const { user } = useAuth();

  const addWatermark = async (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 342 424">
      <defs><style>path { fill: #ffffff91; }</style></defs>
      <g transform="translate(0.000000,424.000000) scale(0.100000,-0.100000)">
        <path d="M1630 3789 c-335 -34 -629 -216 -828 -510 -51 -76 -118 -218 -151 -319 -59 -187 -75 -273 -96 -526 -8 -99 -28 -341 -45 -539 -17 -198 -41 -493 -55 -655 -29 -347 -53 -612 -60 -693 l-6 -58 91 3 91 3 133 295 c74 162 146 324 162 360 53 124 175 385 183 393 5 5 30 -3 57 -17 147 -75 304 -134 435 -161 247 -52 474 -15 768 126 114 54 141 62 141 39 0 -5 13 -37 29 -72 80 -174 131 -288 131 -292 0 -4 94 -217 149 -340 11 -22 38 -84 61 -136 23 -52 53 -119 65 -147 16 -35 30 -53 42 -54 110 -3 168 -1 168 7 -1 20 -18 224 -46 549 -16 187 -51 608 -79 935 -55 651 -54 645 -81 776 -120 598 -498 986 -1007 1034 -119 11 -131 11 -252 -1z m286 -558 c255 -66 453 -277 509 -542 75 -357 -166 -724 -529 -804 -113 -25 -274 -17 -376 19 -222 78 -388 253 -444 466 -80 301 39 607 301 777 58 38 178 85 243 96 71 12 229 6 296 -12z"/>
        <path d="M1680 2861 c-96 -20 -182 -89 -224 -180 -16 -35 -21 -65 -21 -126 0 -74 3 -85 38 -147 58 -104 148 -160 261 -161 159 -2 273 88 312 245 16 63 16 73 1 133 -18 71 -61 142 -105 173 -80 57 -180 81 -262 63z"/>
      </g>
    </svg>`;

    const logoImg = new Image();
    await new Promise((resolve, reject) => {
      logoImg.onload = resolve;
      logoImg.onerror = reject;
      logoImg.src = "data:image/svg+xml;base64," + btoa(logoSvg);
    });

    const margin = 30;
    const logoWidth = 38;
    const logoHeight = 38;
    const x = width - logoWidth - margin - 130;
    const y = height - logoHeight - margin;

    ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);

    ctx.font = "bold 34px Arial";
    ctx.fillStyle = "#ffffff91";
    ctx.textBaseline = "middle";
    ctx.fillText("Hondolab", x + logoWidth + 3, y + logoHeight / 2 + 3);
  };

  const loadImage = async () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = image.publishedImage.url;
      });

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      await addWatermark(ctx, img.width, img.height);
    } catch (error) {
      console.error("Image loading failed:", error);
    }
  };

  useEffect(() => {
    loadImage();
  }, [image.publishedImage.url]);

  const handleNewDrawing = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (user) {
      router.push(`/drawing/?modelId=${image.task.loraModel}`);
    } else {
      onNewDrawing(image.task.loraModel);
    }
  };


  return (
    <div
      className="relative aspect-square w-full group cursor-pointer transition-transform duration-300 ease-in-out transform hover:scale-105"
      onClick={onClick}
    >
      <div className="relative aspect-square rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover rounded-lg"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            className="p-2 m-2 flex bg-gray-100 text-custom-white rounded-full hover:bg-custom-logo-purple dark:hover:bg-gray-800 z-[99] absolute top-0 right-0"
            aria-label="Start Creating"
            onClick={handleNewDrawing}
          >
            <CreateIcon
              className="w-full h-full text-custom-white"
              wrapperClassName="w-[16px] h-[16px]"
            />
          </button>

          {user && (
            <div className="absolute top-0 left-0 m-2 z-10">
              <ActionButton
                onClick={(e) => {
                  e.stopPropagation();
                  handleReaction(image.publishedImage.id, "like");
                }}
                icon={ThumbsUp}
                title={
                  image.publishedImage.userReaction?.like ? "Undo like" : "Like"
                }
                isActive={image.publishedImage.userReaction?.like}
                activeColor="text-custom-logo-purple"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageCard;
