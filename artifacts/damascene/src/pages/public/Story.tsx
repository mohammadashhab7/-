import { useListContentBlocks } from "@workspace/api-client-react";

export default function StoryPage() {
  const { data: blocks } = useListContentBlocks({ page: "story" });
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <header className="text-center mb-12">
        <h1 className="font-serif text-4xl md:text-5xl text-primary mb-4">قصتنا</h1>
        <p className="text-foreground/70 text-lg">إرث دمشقي يتوارث منذ أكثر من قرن</p>
      </header>
      <div className="prose prose-lg mx-auto text-foreground/80 leading-loose space-y-6">
        {blocks && blocks.length > 0 ? (
          blocks.map((b) => (
            <section key={b.id}>
              {b.titleAr && <h2 className="font-serif text-2xl text-primary mt-8 mb-3">{b.titleAr}</h2>}
              {b.contentAr && <p className="whitespace-pre-line">{b.contentAr}</p>}
            </section>
          ))
        ) : (
          <p className="text-center text-foreground/60">لا يوجد محتوى متاح حالياً.</p>
        )}
      </div>
    </div>
  );
}
