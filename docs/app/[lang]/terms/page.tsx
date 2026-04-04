import type { Metadata } from "next";
import { baseOptions } from "@/lib/layout.shared";
import { CustomHeader } from "../(home)/_components/custom-header";
import { Footer } from "../(home)/_components/footer";

const content = {
  en: {
    title: "TalkCody Terms of Service",
    description: "Terms that govern your use of the TalkCody desktop app and website.",
    effectiveDate: "January 26, 2026",
    intro:
      "These Terms of Service govern your use of the TalkCody desktop application and the website at https://www.talkcody.com. By using TalkCody, you agree to these terms.",
    sections: {
      eligibility: {
        title: "Eligibility and Accounts",
        paragraphs: [
          "You can use TalkCody without creating an account. If you choose to sign in, you are responsible for maintaining the confidentiality of your account credentials.",
        ],
      },
      license: {
        title: "License and Acceptable Use",
        intro:
          "We grant you a personal, non-exclusive, non-transferable license to use TalkCody for lawful purposes. You agree not to:",
        items: [
          "Reverse engineer, decompile, or attempt to extract the source code from the application, except where permitted by law.",
          "Use TalkCody to violate any applicable laws or regulations.",
          "Distribute malware, spam, or abusive content using the application or its services.",
          "Interfere with or disrupt the integrity or performance of TalkCody or related services.",
        ],
      },
      yourData: {
        title: "Your Data",
        paragraphs: [
          "You retain ownership of your code and content. You are responsible for the data you input into TalkCody and for any outputs you choose to use.",
          "If you connect to third-party AI providers, your requests are processed by those providers subject to their terms.",
        ],
      },
      thirdParty: {
        title: "Third-Party Services",
        paragraphs: [
          "TalkCody may integrate with third-party services you choose to use. We are not responsible for third-party services, and their terms and policies apply.",
        ],
      },
      openSource: {
        title: "Open Source",
        paragraphs: [
          "TalkCody includes open-source software. Use of those components is governed by their respective licenses.",
        ],
      },
      warranty: {
        title: "Disclaimer of Warranties",
        paragraphs: [
          "TalkCody is provided on an " +
            "\"as is\" and \"as available\" basis. We disclaim all warranties to the maximum extent permitted by law.",
        ],
      },
      liability: {
        title: "Limitation of Liability",
        paragraphs: [
          "To the maximum extent permitted by law, TalkCody and its contributors are not liable for any indirect, incidental, or consequential damages arising from your use of the service.",
        ],
      },
      termination: {
        title: "Termination",
        paragraphs: [
          "We may suspend or terminate your access to TalkCody if you materially breach these Terms. You may stop using TalkCody at any time.",
        ],
      },
      changes: {
        title: "Changes to These Terms",
        paragraphs: [
          "We may update these Terms from time to time. We will post the updated version on this page with a new effective date.",
        ],
      },
      contact: {
        title: "Contact Us",
        paragraphs: [
          "If you have questions about these Terms, contact us at kaisenkang@talkcody.com.",
        ],
      },
    },
  },
  zh: {
    title: "TalkCody 服务条款",
    description: "规范您使用 TalkCody 桌面应用程序和网站的条款。",
    effectiveDate: "2026年1月26日",
    intro:
      "本服务条款规范您使用 TalkCody 桌面应用程序和 https://www.talkcody.com 网站。通过使用 TalkCody，您同意这些条款。",
    sections: {
      eligibility: {
        title: "资格和账户",
        paragraphs: [
          "您可以在不创建账户的情况下使用 TalkCody。如果您选择登录，您有责任维护账户凭证的保密性。",
        ],
      },
      license: {
        title: "许可和可接受使用",
        intro:
          "我们授予您个人、非排他性、不可转让的许可证，允许您将 TalkCody 用于合法目的。您同意不会：",
        items: [
          "反编译、反向工程或尝试从应用程序中提取源代码，法律允许的情况除外。",
          "使用 TalkCody 违反任何适用的法律或法规。",
          "使用应用程序或其服务分发恶意软件、垃圾邮件或滥用内容。",
          "干扰或破坏 TalkCody 或相关服务的完整性或性能。",
        ],
      },
      yourData: {
        title: "您的数据",
        paragraphs: [
          "您保留对代码和内容的所有权。您对输入到 TalkCody 的数据以及选择使用的任何输出负责。",
          "如果您连接到第三方 AI 提供商，您的请求将按照其条款由这些提供商处理。",
        ],
      },
      thirdParty: {
        title: "第三方服务",
        paragraphs: [
          "TalkCody 可能会与您选择使用的第三方服务集成。我们对第三方服务不承担责任，其条款和政策适用。",
        ],
      },
      openSource: {
        title: "开源软件",
        paragraphs: [
          "TalkCody 包含开源软件。这些组件的使用受其各自许可证的约束。",
        ],
      },
      warranty: {
        title: "免责声明",
        paragraphs: [
          "TalkCody 按 " +
            "\"现状\"和\"可用\"的基础提供。我们根据法律允许的最大范围免除所有保证。",
        ],
      },
      liability: {
        title: "责任限制",
        paragraphs: [
          "根据法律允许的最大范围，TalkCody 及其贡献者对因您使用服务而导致的任何间接、附带或后果性损害不承担责任。",
        ],
      },
      termination: {
        title: "终止",
        paragraphs: [
          "如果您严重违反这些条款，我们可能会暂停或终止您对 TalkCody 的访问。您可以随时停止使用 TalkCody。",
        ],
      },
      changes: {
        title: "本条款的变更",
        paragraphs: [
          "我们可能会不时更新这些条款。我们将在此页面发布更新版本，并注明新的生效日期。",
        ],
      },
      contact: {
        title: "联系我们",
        paragraphs: [
          "如果您对这些条款有任何疑问，请通过 kaisenkang@talkcody.com 与我们联系。",
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
      url: `https://www.talkcody.com${isDefaultLang ? "" : `/${lang}`}/terms`,
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
      canonical: `https://www.talkcody.com${isDefaultLang ? "" : `/${lang}`}/terms`,
      languages: {
        en: "https://www.talkcody.com/terms",
        zh: "https://www.talkcody.com/zh/terms",
      },
    },
  };
}

export default async function TermsPage({
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

          <h2>{t.sections.eligibility.title}</h2>
          {t.sections.eligibility.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <h2>{t.sections.license.title}</h2>
          <p>{t.sections.license.intro}</p>
          <ul>
            {t.sections.license.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t.sections.yourData.title}</h2>
          {t.sections.yourData.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <h2>{t.sections.thirdParty.title}</h2>
          {t.sections.thirdParty.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <h2>{t.sections.openSource.title}</h2>
          {t.sections.openSource.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <h2>{t.sections.warranty.title}</h2>
          {t.sections.warranty.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <h2>{t.sections.liability.title}</h2>
          {t.sections.liability.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <h2>{t.sections.termination.title}</h2>
          {t.sections.termination.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

          <h2>{t.sections.changes.title}</h2>
          {t.sections.changes.paragraphs.map((paragraph) => (
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
