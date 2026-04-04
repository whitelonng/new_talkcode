import type { Metadata } from "next";
import { baseOptions } from "@/lib/layout.shared";
import { CustomHeader } from "../(home)/_components/custom-header";
import { Footer } from "../(home)/_components/footer";

const content = {
  en: {
    title: "TalkCody Privacy Policy",
    description:
      "How TalkCody handles your data for a privacy-first desktop experience.",
    effectiveDate: "January 26, 2026",
    intro:
      "TalkCody is a desktop application for macOS, Windows, and Linux. You can use TalkCody without signing in. By default, your projects, prompts, and settings are stored locally on your device.",
    sections: {
      informationWeCollect: {
        title: "Information We Collect",
        intro:
          "We collect only the minimum information needed to provide the service:",
        items: [
          "Optional account details if you choose to sign in, such as your email address and name.",
          "Support communications if you contact us, including the content you send and any attachments you provide.",
          "App configuration data and local workspace metadata that is stored on your device.",
        ],
      },
      howWeUseInformation: {
        title: "How We Use Information",
        intro: "We use information to:",
        items: [
          "Provide, operate, and maintain TalkCody.",
          "Respond to support requests and improve the product.",
          "Protect the security and integrity of our services.",
        ],
      },
      localData: {
        title: "Local Data and Device Storage",
        paragraphs: [
          "Your code, prompts, and project files remain on your device unless you explicitly share them.",
          "If you delete the app or remove local data, the local information is removed from your device.",
        ],
      },
      thirdPartyServices: {
        title: "Third-Party Services",
        paragraphs: [
          "If you connect TalkCody to third-party AI providers or services, your requests and data are sent directly to those providers. Their privacy policies and terms apply to that data.",
          "TalkCody does not control how third-party providers process your data.",
        ],
      },
      yourChoices: {
        title: "Your Choices",
        items: [
          "Use TalkCody without signing in.",
          "Choose which AI providers to connect or use local models only.",
          "Contact us to request information about your account data.",
        ],
      },
      updates: {
        title: "Updates to This Policy",
        paragraphs: [
          "We may update this Privacy Policy from time to time. We will post the updated version on this page with a new effective date.",
        ],
      },
      contact: {
        title: "Contact Us",
        paragraphs: [
          "If you have questions about this Privacy Policy, please contact us at kaisenkang@talkcody.com.",
        ],
      },
    },
  },
  zh: {
    title: "TalkCody 隐私政策",
    description:
      "TalkCody 如何处理您的数据，以提供以隐私为本的桌面体验。",
    effectiveDate: "2026年1月26日",
    intro:
      "TalkCody 是一款适用于 macOS、Windows 和 Linux 的桌面应用程序。您可以在不登录的情况下使用 TalkCody。默认情况下，您的项目、提示词和设置存储在本地设备上。",
    sections: {
      informationWeCollect: {
        title: "我们收集的信息",
        intro:
          "我们仅收集提供服务所需的最少信息：",
        items: [
          "如果您选择登录，我们会收集可选的账户详细信息，例如您的电子邮箱地址和姓名。",
          "如果您联系我们，我们会收集支持通讯内容，包括您发送的内容和提供的任何附件。",
          "存储在您设备上的应用程序配置数据和本地工作区元数据。",
        ],
      },
      howWeUseInformation: {
        title: "我们如何使用信息",
        intro: "我们使用信息来：",
        items: [
          "提供、运营和维护 TalkCody。",
          "回复支持请求并改进产品。",
          "保护我们服务的安全性和完整性。",
        ],
      },
      localData: {
        title: "本地数据和设备存储",
        paragraphs: [
          "您的代码、提示词和项目文件保留在您的设备上，除非您明确分享它们。",
          "如果您删除应用程序或移除本地数据，本地信息将从您的设备中移除。",
        ],
      },
      thirdPartyServices: {
        title: "第三方服务",
        paragraphs: [
          "如果您将 TalkCody 连接到第三方 AI 提供商或服务，您的请求和数据将直接发送给这些提供商。它们的隐私政策和使用条款适用于这些数据。",
          "TalkCody 无法控制第三方提供商如何处理您的数据。",
        ],
      },
      yourChoices: {
        title: "您的选择",
        items: [
          "在不登录的情况下使用 TalkCody。",
          "选择连接哪些 AI 提供商，或仅使用本地模型。",
          "联系我们以请求获取您的账户数据信息。",
        ],
      },
      updates: {
        title: "本政策的更新",
        paragraphs: [
          "我们可能会不时更新本隐私政策。我们将在此页面发布更新版本，并注明新的生效日期。",
        ],
      },
      contact: {
        title: "联系我们",
        paragraphs: [
          "如果您对本隐私政策有任何疑问，请通过 kaisenkang@talkcody.com 与我们联系。",
        ],
      },
    },
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = content[lang as keyof typeof content] || content.en;
  const isDefaultLang = lang === "en";

  return {
    metadataBase: new URL("https://www.talkcody.com"),
    title: t.title,
    description: t.description,
    openGraph: {
      title: t.title,
      description: t.description,
      url: `https://www.talkcody.com${isDefaultLang ? "" : `/${lang}`}/privacy`,
      siteName: "TalkCody",
      type: "website",
      images: [
        {
          url: "https://cdn.talkcody.com/images/talkcody_og.jpg",
          width: 1200,
          height: 630,
          alt: "TalkCody",
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
      canonical: `https://www.talkcody.com${isDefaultLang ? "" : `/${lang}`}/privacy`,
      languages: {
        en: "https://www.talkcody.com/privacy",
        zh: "https://www.talkcody.com/zh/privacy",
      },
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = content[lang as keyof typeof content] || content.en;
  const options = baseOptions(lang);

  return (
    <div data-fd-home-layout className="bg-black text-white min-h-screen">
      <CustomHeader
        title={options.nav?.title || "TalkCody"}
        homeUrl={options.nav?.url || "/"}
        links={options.links || []}
        lang={lang}
      />
      <main className="container max-w-4xl px-6 md:px-8 pt-16 pb-24">
        <article className="prose prose-invert prose-zinc max-w-none">
          <h1>{t.title}</h1>
          <p className="text-sm text-zinc-400">Effective date: {t.effectiveDate}</p>
          <p>{t.intro}</p>

          <h2>{t.sections.informationWeCollect.title}</h2>
          <p>{t.sections.informationWeCollect.intro}</p>
          <ul>
            {t.sections.informationWeCollect.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t.sections.howWeUseInformation.title}</h2>
          <p>{t.sections.howWeUseInformation.intro}</p>
          <ul>
            {t.sections.howWeUseInformation.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t.sections.localData.title}</h2>
          {t.sections.localData.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <h2>{t.sections.thirdPartyServices.title}</h2>
          {t.sections.thirdPartyServices.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <h2>{t.sections.yourChoices.title}</h2>
          <ul>
            {t.sections.yourChoices.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t.sections.updates.title}</h2>
          {t.sections.updates.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <h2>{t.sections.contact.title}</h2>
          {t.sections.contact.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
