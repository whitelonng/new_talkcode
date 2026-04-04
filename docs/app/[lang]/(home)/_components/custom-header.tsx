import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { LinkItemType } from "fumadocs-ui/layouts/shared";

interface CustomHeaderProps {
  title: React.ReactNode;
  homeUrl: string;
  links: LinkItemType[];
  lang: string;
}

export function CustomHeader({ title, homeUrl, links, lang }: CustomHeaderProps) {
  return (
    <header className="sticky max-w-5xl mx-auto px-6 top-6 rounded-full z-50 w-full border border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl shadow-black/50">
      <div className="container mx-auto px-2">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href={homeUrl} className="flex items-center gap-2 hover:opacity-80 transition-opacity text-white font-bold tracking-tight">
            {title}
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {links.map((link, index) => {
              // Skip icon links in center nav
              if (link.type === "icon") return null;

              // Type guard: only process links with url property
              if (!("url" in link) || !link.url) return null;

              // Regular text link
              return (
                <Link
                  key={index}
                  href={link.url}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full px-4 py-2 transition-all"
                >
                  {link.text}
                </Link>
              );
            })}
          </nav>

          {/* Right side - CTA Button + Icons */}
          <div className="flex items-center gap-3">
            {/* Icon links */}
            <div className="hidden md:flex items-center gap-1">
              {links.map((link, index) => {
                // Type guard: check if link has required properties
                if (link.type === "icon" && "icon" in link && "url" in link && link.icon && link.url) {
                  return (
                    <Button
                      key={index}
                      variant="ghost"
                      size="icon"
                      asChild
                      className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full"
                    >
                      <Link
                        href={link.url}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                        aria-label={typeof link.text === "string" ? link.text : "Link"}
                      >
                        {link.icon}
                      </Link>
                    </Button>
                  );
                }
                return null;
              })}
            </div>

            {/* Download/Get Started CTA */}
            <Button
              asChild
              size="sm"
              className="hidden md:inline-flex rounded-full bg-white hover:bg-zinc-200 text-black border border-transparent hover:border-zinc-200 px-5 h-9 font-semibold transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            >
              <Link href={`/${lang}/docs/introduction/client-downloads`}>
                {lang === "zh" ? "立即下载" : "Get Started"}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>

            {/* Mobile menu button */}
            <Button variant="ghost" size="icon" className="lg:hidden text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full" aria-label="Open menu">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
