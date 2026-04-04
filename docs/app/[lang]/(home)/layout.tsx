import { baseOptions } from "@/lib/layout.shared";
import { CustomHeader } from "./_components/custom-header";

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}) {
  const { lang } = await params;
  const options = baseOptions(lang);

  return (
    <div data-fd-home-layout className="bg-black text-white min-h-screen">
      <CustomHeader
        title={options.nav?.title || "TalkCody"}
        homeUrl={options.nav?.url || "/"}
        links={options.links || []}
        lang={lang}
      />
      <main>{children}</main>
    </div>
  );
}
