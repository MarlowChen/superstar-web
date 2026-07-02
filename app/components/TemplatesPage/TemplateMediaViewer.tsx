"use client";

import Image from "next/image";

type TemplateMediaViewerProps = {
  open: boolean;
  src: string;
  kind: "image" | "video";
  alt: string;
  poster?: string;
  closeLabel: string;
  onClose: () => void;
};

export default function TemplateMediaViewer({
  open,
  src,
  kind,
  alt,
  poster,
  closeLabel,
  onClose,
}: TemplateMediaViewerProps) {
  if (!open || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#06101d]/92 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:bg-white/20"
      >
        {closeLabel}
      </button>

      <div
        className="relative flex h-full max-h-[100dvh] w-full max-w-[100vw] items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        {kind === "video" ? (
          <video
            src={src}
            poster={poster}
            className="max-h-[calc(100dvh-48px)] max-w-full rounded-2xl object-contain shadow-2xl sm:max-h-[calc(100dvh-64px)]"
            controls
            playsInline
            preload="metadata"
            autoPlay
          />
        ) : (
          <div className="relative h-[calc(100dvh-48px)] w-full sm:h-[calc(100dvh-64px)]">
            <Image
              src={src}
              alt={alt}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
        )}
      </div>
    </div>
  );
}
