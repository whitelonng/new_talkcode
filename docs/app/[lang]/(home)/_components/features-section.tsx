import {
  Layers,
  Mic,
  Image as ImageIcon,
  Puzzle,
  Plug,
  Share2,
  Code2,
  Zap,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const translations = {
  en: {
    badge: "Features",
    sectionTitle: "Engineered for Performance",
    sectionSubtitle: "A complete toolkit for the modern developer. Everything you need to code faster, smarter, and more efficiently.",
    features: {
      multiModel: {
        title: "Any Model, Any Provider",
        desc: "Switch between OpenAI, Anthropic, Google, or local models instantly. No vendor lock-in. Use what works best for each task.",
      },
      multiModal: {
        title: "Multimodal Input",
        desc: "Text, voice, images, and files work seamlessly together. Code naturally with the input method that suits you.",
      },
      mcp: {
        title: "MCP Server Support",
        desc: "Extend capabilities infinitely through Model Context Protocol. Connect to any tool or service.",
      },
      marketplace: {
        title: "Agents & Skills Marketplace",
        desc: "Download and share community workflows and specialized agents. Stand on the shoulders of giants.",
      },
      skills: {
        title: "Fully Customizable",
        desc: "System prompts, agents, tools, MCP servers—everything is configurable. Make it truly yours.",
      },
      local: {
        title: "Privacy First",
        desc: "Run local LLMs. Your code stays on your machine.",
      },
      fast: {
        title: "Lightning Fast",
        desc: "Built with Rust and Tauri for native performance.",
      },
    },
  },
  zh: {
    badge: "产品特性",
    sectionTitle: "为性能而生",
    sectionSubtitle: "现代开发者的完整工具箱。帮助您更快、更智能、更高效地编写代码所需的一切。",
    features: {
      multiModel: {
        title: "任意模型，任意提供商",
        desc: "在 OpenAI、Anthropic、Google 或本地模型之间即时切换。无供应商锁定。为每个任务使用最合适的工具。",
      },
      multiModal: {
        title: "多模态输入",
        desc: "文本、语音、图像和文件无缝协作。用最适合您的输入方式自然编码。",
      },
      mcp: {
        title: "MCP 服务器支持",
        desc: "通过模型上下文协议无限扩展能力。连接到任何工具或服务。",
      },
      marketplace: {
        title: "代理和技能市场",
        desc: "下载和分享社区工作流和专业代理。站在巨人的肩膀上。",
      },
      skills: {
        title: "完全可定制",
        desc: "系统提示、代理、工具、MCP 服务器——一切都可配置。让它真正属于您。",
      },
      local: {
        title: "隐私至上",
        desc: "运行本地 LLM。您的代码保留在您的机器上。",
      },
      fast: {
        title: "极速体验",
        desc: "基于 Rust 和 Tauri 构建，拥有原生性能。",
      },
    },
  },
};

// Bento Grid Item Component - Server Component with CSS animations
function BentoItem({
  title,
  description,
  icon: Icon,
  className,
  children,
  delay = 0,
}: {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  children?: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 transition-all duration-300 animate-fade-in-up",
        className
      )}
      style={{ animationDelay: `${delay * 1000}ms` }}
    >
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-4">
          {Icon && (
            <div className="p-2 rounded-lg bg-zinc-800/80 text-white">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <h3 className="text-xl font-bold text-zinc-100">{title}</h3>
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed mb-4">
          {description}
        </p>
        <div className="mt-auto">{children}</div>
      </div>

      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}

export function FeaturesSection({ lang }: { lang: string }) {
  const t = translations[lang as keyof typeof translations] || translations.en;

  return (
    <section className="container py-24 relative">
      {/* Background Grid */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="text-center space-y-4 mb-16">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
          {t.sectionTitle}
        </h2>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
          {t.sectionSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {/* Large Item - Multi Model */}
        <BentoItem
          title={t.features.multiModel.title}
          description={t.features.multiModel.desc}
          icon={Layers}
          className="md:col-span-2 md:row-span-2 min-h-[400px]"
        >
          <div className="relative w-full h-full min-h-[200px] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center">
            {/* Abstract representation of models switching */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,120,120,0.1),rgba(0,0,0,0))]" />
            <div className="grid grid-cols-2 gap-4 p-8 w-full">
              {[
                "GPT-5.2",
                "DeepSeek",
                "Gemini 3",
                "GLM 4.7",
                "MiniMax M2.1",
                "Kimi K2",
              ].map((model, i) => (
                <div
                  key={model}
                  className="bg-zinc-900 border border-zinc-700/50 p-4 rounded-lg flex items-center justify-between"
                >
                  <span className="text-zinc-300 font-mono text-sm">
                    {model}
                  </span>
                  <div
                    className={`w-2 h-2 rounded-full ${i === 1 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-zinc-700"}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </BentoItem>

        {/* Tall Item - Marketplace */}
        <BentoItem
          title={t.features.marketplace.title}
          description={t.features.marketplace.desc}
          icon={Share2}
          className="md:row-span-2 bg-zinc-900/80"
          delay={0.1}
        >
          <div className="relative w-full h-full min-h-[200px] flex flex-col gap-3 pt-4">
            {[1, 2, 3].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/50"
              >
                <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                  <Puzzle className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="h-2 w-24 bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        </BentoItem>

        {/* Standard Item - Multi Modal */}
        <BentoItem
          title={t.features.multiModal.title}
          description={t.features.multiModal.desc}
          icon={Mic}
          delay={0.2}
        >
          <div className="flex gap-4 mt-4 opacity-50 grayscale">
            <ImageIcon className="w-8 h-8" />
            <Mic className="w-8 h-8" />
            <Code2 className="w-8 h-8" />
          </div>
        </BentoItem>

        {/* Standard Item - MCP */}
        <BentoItem
          title={t.features.mcp.title}
          description={t.features.mcp.desc}
          icon={Plug}
          delay={0.3}
        />

        {/* NEW Item - Skills Marketplace */}
        <BentoItem
          title={t.features.skills.title}
          description={t.features.skills.desc}
          icon={Wrench}
          delay={0.35}
        />

        {/* Wide Item - Privacy & Speed */}
        <BentoItem
          title={t.features.fast.title}
          description={t.features.fast.desc}
          icon={Zap}
          className="md:col-span-3"
          delay={0.4}
        >
          <div className="h-2 w-full bg-zinc-800 rounded-full mt-4 overflow-hidden">
            <div className="h-full w-2/3 bg-white rounded-full animate-pulse" />
          </div>
        </BentoItem>
      </div>
    </section>
  );
}
