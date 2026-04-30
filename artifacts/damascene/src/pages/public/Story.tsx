import { useListContentBlocks } from "@workspace/api-client-react";

type BlockMetadata = {
  videoUrl?: string;
  posterUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export default function StoryPage() {
  const { data: blocks, isPending } = useListContentBlocks({ page: "story" });
  const heroBlock = blocks?.find((b) => b.key === "story_hero");
  const heroMeta = (heroBlock?.metadata ?? {}) as BlockMetadata;
  const bodyBlocks = blocks?.filter((b) => b.key !== "story_hero") ?? [];

  // Only treat the page as "empty" once the query has resolved. While loading
  // we render nothing to avoid flashing a hardcoded "قصتنا" header that then
  // gets replaced by the real CMS content.
  const hasResolved = !isPending;
  const showFallbackHeader = hasResolved && !heroBlock;
  const showEmptyMessage =
    hasResolved && !heroBlock && bodyBlocks.length === 0;

  return (
    <div>
      {heroBlock && (heroMeta.videoUrl || heroBlock.imageUrl) && (
        <section className="relative overflow-hidden bg-black">
          <div className="aspect-video max-h-[70vh] mx-auto">
            {heroMeta.videoUrl ? (
              <video
                className="w-full h-full object-cover"
                src={heroMeta.videoUrl}
                poster={heroMeta.posterUrl ?? heroBlock.imageUrl ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : heroBlock.imageUrl ? (
              <img
                src={heroBlock.imageUrl}
                alt={heroBlock.titleAr ?? "story"}
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
          {(heroBlock.titleAr || heroBlock.contentAr) && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center text-white p-6">
              {heroBlock.titleAr && (
                <h1 className="font-serif text-4xl md:text-6xl mb-3">{heroBlock.titleAr}</h1>
              )}
              {heroBlock.contentAr && (
                <p className="text-lg md:text-xl max-w-2xl">{heroBlock.contentAr}</p>
              )}
            </div>
          )}
        </section>
      )}
      <div className="container mx-auto max-w-4xl px-4 py-16">
        {showFallbackHeader && (
          <header className="text-center mb-12">
            <h1 className="font-serif text-4xl md:text-5xl text-primary mb-4">قصتنا</h1>
            <p className="text-foreground/70 text-lg">إرث دمشقي يتوارث منذ أكثر من قرن</p>
          </header>
        )}
        <div className="prose prose-lg mx-auto text-foreground/80 leading-loose space-y-6">
          {bodyBlocks.length > 0
            ? bodyBlocks.map((b) => (
                <section key={b.id}>
                  {b.titleAr && <h2 className="font-serif text-2xl text-primary mt-8 mb-3">{b.titleAr}</h2>}
                  {b.contentAr && <p className="whitespace-pre-line">{b.contentAr}</p>}
                </section>
              ))
            : showEmptyMessage && (
                <p className="text-center text-foreground/60">لا يوجد محتوى متاح حالياً.</p>
              )}
        </div>
      </div>
    </div>
  );
}
