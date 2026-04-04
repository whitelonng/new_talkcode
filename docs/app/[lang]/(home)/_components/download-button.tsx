"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { detectPlatform, getDownloadInfo } from "@/lib/download-utils";
import type { Platform } from "@/lib/download-utils";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface DownloadButtonProps {
  lang: string;
  downloadText: string;
  downloadForText: string;
}

export function DownloadButton({ lang, downloadText, downloadForText }: DownloadButtonProps) {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [ready, setReady] = useState(false);

  const initPlatform = useCallback(() => {
    const savedPlatform = localStorage.getItem('talkcody-platform') as Platform | null;
    if (savedPlatform && savedPlatform !== 'unknown') {
      setPlatform(savedPlatform);
    } else {
      setPlatform(detectPlatform());
    }
    setReady(true);
  }, []);

  useEffect(() => {
    // Run platform detection immediately on mount
    initPlatform();
  }, [initPlatform]);

  const downloadInfo = getDownloadInfo(platform);
  const showPlatformText = ready && downloadInfo.available && platform !== "unknown";
  const downloadButtonText = showPlatformText
    ? `${downloadForText} ${downloadInfo.displayName}`
    : downloadText;

  const downloadHref = ready
    ? downloadInfo.available
      ? downloadInfo.downloadUrl
      : `/${lang}/docs/introduction/client-downloads`
    : `/${lang}/docs/introduction/client-downloads`;

  return (
    <Button
      asChild
      size="lg"
      className="h-14 px-8 text-base rounded-full bg-white text-black hover:bg-zinc-200 hover:scale-105 font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)] min-w-[280px] sm:min-w-[320px]"
    >
      <Link href={downloadHref}>
        <div className="flex items-center justify-center gap-2">
          <span className={`transition-opacity duration-100 ${ready ? "opacity-100" : "opacity-0"}`}>
            {downloadButtonText}
          </span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </div>
      </Link>
    </Button>
  );
}
