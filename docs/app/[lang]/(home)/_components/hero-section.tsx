import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Terminal } from "lucide-react";
import { DownloadButton } from "./download-button";

const translations = {
  en: {
    title: "TalkCody",
    tagline: "Free and Open Source AI Coding Agent",
    description:
      "Generate correct code as quickly and cost-effectively as possible. The next generation of AI-powered development.",
    download: "Download",
    downloadFor: "Download for",
    documentation: "Documentation",
  },
  zh: {
    title: "TalkCody",
    tagline: "免费开源的 AI 编码助手",
    description:
      "用最低的成本，最快的速度生成正确代码。下一代 AI 驱动的开发工具。",
    download: "下载",
    downloadFor: "下载",
    documentation: "查看文档",
  },
};

export function HeroSection({ lang }: { lang: string }) {
  const t = translations[lang as keyof typeof translations] || translations.en;

  return (
    <section className="relative flex flex-col justify-center min-h-[90vh] overflow-hidden bg-black pt-20 pb-32">

      <div className="container relative z-10 max-w-6xl mx-auto px-4">
        <div className="flex flex-col items-center text-center space-y-12">

          {/* Badge - CSS animation, no JS required */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-800 text-sm font-medium text-zinc-300 shadow-lg shadow-zinc-900/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Code is cheap, show me your talk.
          </div>

          <div className="space-y-6 max-w-5xl">
            <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-[7rem] font-bold tracking-tighter leading-[0.9]">
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-zinc-200 to-zinc-500">
                {t.title}
              </span>
            </h1>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium tracking-tight text-zinc-400">
              {t.tagline}
            </h2>
          </div>

          {/* Description */}
          <p className="text-lg sm:text-xl text-zinc-500 max-w-2xl leading-relaxed font-light">
            {t.description}
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto">
            {/* Download button - client component for platform detection */}
            <DownloadButton
              lang={lang}
              downloadText={t.download}
              downloadForText={t.downloadFor}
            />

            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-14 px-8 text-base rounded-full bg-black text-white border border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700 transition-all duration-300 font-medium"
            >
              <Link href={`/${lang}/docs`}>
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-zinc-400" />
                  {t.documentation}
                </div>
              </Link>
            </Button>
          </div>

          {/* Tech Stack */}
          <div className="pt-12 flex flex-col items-center gap-4">
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-600">Powered By</span>
            <div className="flex items-center gap-8 text-zinc-500 grayscale opacity-60 hover:opacity-100 transition-opacity duration-500">
              <span className="font-mono font-bold text-sm">TAURI</span>
              <span className="w-1 h-1 rounded-full bg-zinc-800" />
              <span className="font-mono font-bold text-sm">RUST</span>
              <span className="w-1 h-1 rounded-full bg-zinc-800" />
              <span className="font-mono font-bold text-sm">VERCEL AI</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
