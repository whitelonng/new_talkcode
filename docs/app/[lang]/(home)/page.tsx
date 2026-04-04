import type { Metadata } from "next";
import { HeroSection } from "./_components/hero-section";
import { Footer } from "./_components/footer";
import { DemoVideoSection } from "./_components/demo-video-section";
import { WhyChooseSection } from "./_components/why-choose-section";
import { FeaturesSection } from "./_components/features-section";
import { DownloadCtaSection } from "./_components/download-cta-section";

const seoTranslations = {
  en: {
    title: "TalkCody - Free and Open Source AI Coding Agent",
    description:
      "Generate correct code as quickly and cost-effectively as possible. The next generation of AI-powered development with multi-model support, privacy-first design, and native performance.",
  },
  zh: {
    title: "TalkCody - 免费开源的 AI 编码助手",
    description:
      "用最低的成本，最快的速度生成正确代码。支持多模型、隐私优先、原生性能的下一代 AI 开发工具。",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t =
    seoTranslations[lang as keyof typeof seoTranslations] || seoTranslations.en;
  const isDefaultLang = lang === "en";

  return {
    metadataBase: new URL("https://www.talkcody.com"),
    title: t.title,
    description: t.description,
    openGraph: {
      title: t.title,
      description: t.description,
      url: `https://www.talkcody.com${isDefaultLang ? "" : `/${lang}`}`,
      siteName: "TalkCody",
      type: "website",
      images: [
        {
          url: "https://cdn.talkcody.com/images/talkcody_og.jpg",
          width: 1200,
          height: 630,
          alt: "TalkCody - AI Coding Agent",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t.title,
      description: t.description,
      images: ["https://cdn.talkcody.com/images/talkcody_og.jpg"],
    },
    alternates: {
      canonical: `https://www.talkcody.com${isDefaultLang ? "" : `/${lang}`}`,
      languages: {
        en: "https://www.talkcody.com/",
        zh: "https://www.talkcody.com/zh",
      },
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <div className="flex flex-col min-h-screen">
      {/* Critical above-the-fold content */}
      <HeroSection lang={lang} />

      {/* Below-the-fold content - now server components with CSS animations */}
      <DemoVideoSection lang={lang} />
      <WhyChooseSection lang={lang} />
      <FeaturesSection lang={lang} />
      <DownloadCtaSection lang={lang} />
      <Footer lang={lang} />
    </div>
  );
}
