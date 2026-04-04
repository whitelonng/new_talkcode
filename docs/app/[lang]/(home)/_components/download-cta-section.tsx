"use client";

import { ArrowRight, Download, Github } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { detectPlatform, getDownloadInfo } from "@/lib/download-utils";
import type { Platform } from "@/lib/download-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const translations = {
  en: {
    title: "Ready to Transform Your Coding Experience?",
    subtitle:
      "Download TalkCody now and start coding with AI that respects your privacy and freedom.",
    download: "Download",
    downloadFor: "Download for",
    viewOnGitHub: "View on GitHub",
  },
  zh: {
    title: "准备好改变您的编码体验了吗？",
    subtitle: "立即下载 TalkCody，开始使用尊重您隐私和自由的 AI 编码。",
    download: "下载",
    downloadFor: "下载",
    viewOnGitHub: "在 GitHub 上查看",
  },
};

export function DownloadCtaSection({ lang }: { lang: string }) {
  const t = translations[lang as keyof typeof translations] || translations.en;
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedPlatform = localStorage.getItem(
      "talkcody-platform"
    ) as Platform | null;
    if (savedPlatform && savedPlatform !== "unknown") {
      setPlatform(savedPlatform);
    } else {
      const detected = detectPlatform();
      setPlatform(detected);
    }
  }, []);

  const downloadInfo = getDownloadInfo(platform);
  const downloadButtonText = mounted
    ? downloadInfo.available && platform !== "unknown"
      ? `${t.downloadFor} ${downloadInfo.displayName}`
      : t.download
    : t.download;

  const downloadHref = mounted
    ? downloadInfo.available
      ? downloadInfo.downloadUrl
      : `/${lang}/docs/introduction/client-downloads`
    : `/${lang}/docs/introduction/client-downloads`;

  return (
    <section className="relative py-24 overflow-hidden bg-black">
      {/* Metallic Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />

      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-8 animate-fade-in-up">
          {/* Title */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            {t.title}
          </h2>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto animation-delay-100 animate-fade-in-up">
            {t.subtitle}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6 animation-delay-200 animate-fade-in-up">
            {/* Primary Download Button - White Metallic */}
            <Button
              asChild
              size="lg"
              className={cn(
                "group inline-flex items-center justify-center gap-2 h-14",
                "rounded-full bg-white text-black px-8 text-base font-bold",
                "hover:bg-zinc-200 hover:scale-105",
                "transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              )}
            >
              <Link href={downloadHref}>
                <Download className="h-5 w-5" />
                {downloadButtonText}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>

            {/* Secondary GitHub Button - Dark Outline */}
            <Button
              asChild
              variant="outline"
              size="lg"
              className={cn(
                "group inline-flex items-center justify-center gap-2 h-14",
                "rounded-full border border-zinc-800 bg-black text-zinc-300",
                "px-8 text-base font-medium",
                "transition-all hover:bg-zinc-900 hover:text-white hover:border-zinc-700"
              )}
            >
              <a
                href="https://github.com/talkcody/talkcody"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-5 w-5" />
                {t.viewOnGitHub}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
