import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogSource, getBlogImage } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

const translations = {
  en: {
    backToBlog: "Back to Blog",
  },
  zh: {
    backToBlog: "返回博客",
  },
};

export default async function BlogPost(props: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const params = await props.params;
  const t =
    translations[params.lang as keyof typeof translations] || translations.en;
  const page = blogSource.getPage([params.slug], params.lang);
  if (!page) notFound();

  const MDX = page.data.body;
  const date = new Date(page.data.date as string);
  const locale = params.lang === "zh" ? "zh-CN" : "en-US";
  const formattedDate = date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="container max-w-4xl py-16 px-6 md:px-8">
      <Link
        href={`/${params.lang}/blog`}
        className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary mb-12 transition-colors"
      >
        <div className="p-1 rounded-full bg-secondary group-hover:bg-primary/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </div>
        {t.backToBlog}
      </Link>

      <article>
        <header className="flex flex-col items-center text-center mb-16 space-y-6">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <time
              dateTime={page.data.date as string}
              className="font-medium text-foreground"
            >
              {formattedDate}
            </time>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span className="font-medium">{page.data.author}</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground max-w-3xl leading-tight">
            {page.data.title}
          </h1>

          {page.data.description && (
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl leading-relaxed font-light">
              {page.data.description}
            </p>
          )}

          {page.data.tags && page.data.tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-4">
              {page.data.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm font-medium rounded-full bg-secondary/50 text-secondary-foreground border border-transparent hover:border-border transition-colors cursor-default"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="prose prose-lg prose-neutral dark:prose-invert max-w-3xl mx-auto">
          <MDX components={getMDXComponents()} />
        </div>
      </article>

      <div className="max-w-3xl mx-auto mt-20 pt-10 border-t border-border/40">
        <Link
          href={`/${params.lang}/blog`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t.backToBlog}
        </Link>
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  return blogSource.generateParams().map((params) => ({
    ...params,
    slug: params.slug[0],
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = blogSource.getPage([params.slug], params.lang);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: "https://cdn.talkcody.com/images/talkcody_og.jpg",
    },
  };
}
