"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

export default function ModelsRedirect({ locale }: { locale: string }) {
  const router = useRouter();
  const drawingHref = `/${locale}/drawing`;

  useEffect(() => {
    router.replace(drawingHref);
  }, [drawingHref, router]);

  return (
    <main className="flex h-full min-h-0 items-center justify-center bg-custom-gray px-4 dark:bg-custom-gray-dark">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7d90ff] to-[#63cfff] text-white shadow-[0_18px_42px_rgba(99,207,255,0.22)]">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal text-[#10243a] dark:text-white">
          正在前往創作工作台
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#68809f] dark:text-[#aebbd6]">
          模型選擇已整合到創作工作台，稍候會自動帶你過去。
        </p>
        <Link
          href={drawingHref}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#7d90ff,#63cfff)] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(99,207,255,0.2)]"
        >
          前往工作台
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
