import { defineI18nUI } from "fumadocs-ui/i18n";
import { RootProvider } from "fumadocs-ui/provider/next";
import { i18n } from "@/lib/i18n";

const { provider } = defineI18nUI(i18n, {
  translations: {
    en: {
      displayName: "English",
      search: "Search",
      searchNoResult: "No results found",
      toc: "On This Page",
      lastUpdate: "Last updated on",
    },
    zh: {
      displayName: "中文",
      search: "搜索",
      searchNoResult: "未找到结果",
      toc: "本页目录",
      lastUpdate: "最后更新于",
      nextPage: "下一页",
      previousPage: "上一页",
    },
  },
});

export async function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}) {
  const { lang } = await params;
  return (
    <RootProvider i18n={provider(lang)} theme={{ enabled: true, defaultTheme: "dark" }}>
      {children}
    </RootProvider>
  );
}
