import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPosts } from "@/lib/source";

const translations = {
  en: {
    title: "Blog",
    description:
      "Latest updates, tutorials, and insights from the TalkCody team",
    noPosts: "No blog posts yet. Check back soon!",
  },
  zh: {
    title: "博客",
    description: "TalkCody 团队的最新更新、教程和见解",
    noPosts: "暂无博客文章。敬请期待！",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = translations[lang as keyof typeof translations] || translations.en;
  return {
    title: t.title,
    description: t.description,
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = translations[lang as keyof typeof translations] || translations.en;
  const posts = getBlogPosts(lang);

  return (
    <div className="container max-w-4xl py-12 px-4">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">{t.title}</h1>
        <p className="text-muted-foreground text-lg">{t.description}</p>
      </div>

      <div className="space-y-8">
        {posts.map((post) => {
          const date = new Date(post.data.date as string);
          const formattedDate = date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          return (
            <article
              key={post.url}
              className="group border rounded-lg p-6 hover:border-primary transition-colors"
            >
              <Link href={post.url} className="block">
                <div className="flex flex-col gap-2 mb-3">
                  <h2 className="text-2xl font-semibold group-hover:text-primary transition-colors">
                    {post.data.title}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <time dateTime={post.data.date as string}>
                      {formattedDate}
                    </time>
                    <span>•</span>
                    <span>{post.data.author}</span>
                  </div>
                </div>

                {post.data.description && (
                  <p className="text-muted-foreground mb-4">
                    {post.data.description}
                  </p>
                )}

                {post.data.tags && post.data.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.data.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs rounded-md bg-secondary text-secondary-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </article>
          );
        })}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t.noPosts}</p>
        </div>
      )}
    </div>
  );
}
