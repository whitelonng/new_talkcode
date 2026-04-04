const VIDEO_URL = "https://cdn.talkcody.com/images/TalkCody.mp4";

const translations = {
  en: {
    title: "See TalkCody in Action",
    subtitle: "Watch how TalkCody helps you write better code faster",
    playVideo: "Play Demo Video",
    videoPlaceholder: "Demo video coming soon",
  },
  zh: {
    title: "观看 TalkCody 实战",
    subtitle: "了解 TalkCody 如何帮助您更快地编写更好的代码",
    playVideo: "播放演示视频",
    videoPlaceholder: "演示视频即将推出",
  },
};

export function DemoVideoSection({ lang }: { lang: string }) {
  const t = translations[lang as keyof typeof translations] || translations.en;

  return (
    <section className="container py-12 md:py-24">
      <div className="relative max-w-5xl mx-auto">
        <div className="relative animate-fade-in-scale">
          {/* Flowing Border Effect Container */}
          <div className="relative p-[1px] rounded-2xl overflow-hidden bg-zinc-800">
            {/* The Animated Border */}
            <div className="absolute inset-0 bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#ffffff_100%)] animate-[spin_4s_linear_infinite] opacity-20" />

            {/* Inner Content */}
            <div className="relative rounded-2xl bg-black overflow-hidden border border-zinc-800/50 shadow-2xl shadow-black">
              {/* Video Player */}
              <div className="relative bg-zinc-950">
                {/* Video Element */}
                <video
                  className="w-full aspect-video"
                  src={VIDEO_URL}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>
            </div>
          </div>

          {/* Reflection/Glow at the bottom */}
          <div className="absolute -bottom-4 left-[5%] right-[5%] h-12 bg-white/5 blur-3xl rounded-[100%] opacity-20" />
        </div>
      </div>
    </section>
  );
}
