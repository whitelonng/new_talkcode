import { Code, DollarSign, Layers, Shield } from "lucide-react";

const translations = {
  en: {
    badge: "Benefits",
    title: "Why Choose TalkCody",
    subtitle: "Built by developers, for developers who value speed, cost, control, and privacy",
    benefits: [
      {
        icon: Code,
        title: "Blazing Fast Development",
        description:
          "Four-Level Parallelism runs project, task, agent, and tool levels simultaneously—complete complex projects in a fraction of the time. Work the way you actually code: in parallel.",
      },
      {
        icon: DollarSign,
        title: "Maximum Flexibility, Minimum Cost",
        description:
          "8 ways to use completely free. Leverage your existing ChatGPT Plus/GitHub Copilot subscriptions. Or use any AI model from any provider—OpenAI, Anthropic, Google, or local models. Zero vendor lock-in.",
      },
      {
        icon: Layers,
        title: "Professional-Grade Features",
        description:
          "Multimodal input (text, voice, images), MCP Server support, Agents & Skills Marketplace, built-in terminal, and fully customizable workflows. Everything you need in one native app.",
      },
      {
        icon: Shield,
        title: "Privacy You Can Trust",
        description:
          "100% local storage—your code never leaves your machine. Works completely offline with Ollama or LM Studio. You own everything. Fully auditable open-source code.",
      },
    ],
  },
  zh: {
    badge: "核心优势",
    title: "为什么选择 TalkCody",
    subtitle: "由开发者打造，为重视速度、成本、控制权和隐私的开发者服务",
    benefits: [
      {
        icon: Code,
        title: "极速开发体验",
        description:
          "四级并行机制同时运行项目、任务、代理和工具层面——以极短时间完成复杂项目。像您真正编码的方式那样工作：并行处理。",
      },
      {
        icon: DollarSign,
        title: "灵活性最大，成本最低",
        description:
          "8 种完全免费的使用方式。充分利用您现有的 ChatGPT Plus/GitHub Copilot 订阅。或使用任何提供商的任何 AI 模型——OpenAI、Anthropic、Google 或本地模型。零供应商锁定。",
      },
      {
        icon: Layers,
        title: "专业级功能",
        description:
          "多模态输入（文本、语音、图像）、MCP 服务器支持、代理和技能市场、内置终端以及完全可定制的工作流。一个原生应用满足您的所有需求。",
      },
      {
        icon: Shield,
        title: "值得信赖的隐私保护",
        description:
          "100% 本地存储——您的代码永不离开您的机器。使用 Ollama 或 LM Studio 完全离线工作。您拥有一切。完全可审计的开源代码。",
      },
    ],
  },
};

export function WhyChooseSection({ lang }: { lang: string }) {
  const t = translations[lang as keyof typeof translations] || translations.en;

  return (
    <section className="relative py-16 md:py-24 overflow-hidden bg-black">
      <div className="container relative">
        <div className="text-center space-y-6 mb-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-800 text-xs font-medium text-zinc-400 uppercase tracking-wider animate-fade-in-up">
            {t.badge}
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white animate-fade-in-up animation-delay-100">
            {t.title}
          </h2>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto animate-fade-in-up animation-delay-200">
            {t.subtitle}
          </p>
        </div>

        <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto">
          {t.benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="group relative rounded-3xl border border-zinc-800 bg-zinc-900/30 p-8 transition-all hover:bg-zinc-900/50 hover:border-zinc-700 hover:-translate-y-1 animate-fade-in-up"
                style={{ animationDelay: `${300 + index * 100}ms` }}
              >
                {/* Metallic Shine Effect */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="relative z-10 flex flex-col gap-6">
                  {/* Icon area */}
                  <div className="inline-flex self-start p-3 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 text-white group-hover:scale-110 transition-transform duration-300 group-hover:border-zinc-600 group-hover:bg-zinc-800">
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Content area */}
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      {benefit.title}
                    </h3>
                    <p className="text-zinc-400 leading-relaxed">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
