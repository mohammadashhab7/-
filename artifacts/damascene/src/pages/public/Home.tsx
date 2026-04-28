import React, { useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import {
  useListFeaturedProducts,
  useListPublicCategories,
  useListContentBlocks,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroImg from "@/assets/hero.png";
import { imgSrc } from "@/lib/imgSrc";

interface Block {
  key: string;
  titleAr?: string | null;
  bodyAr?: string | null;
  imageUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}

function pickBlock(blocks: Block[] | undefined, key: string): Block | undefined {
  return blocks?.find((b) => b.key === key);
}

export default function HomePage() {
  const { data: categories } = useListPublicCategories();
  const { data: featuredProducts } = useListFeaturedProducts();
  const { data: blocks } = useListContentBlocks({ page: "home" });

  const hero = useMemo(() => pickBlock(blocks as Block[] | undefined, "home_hero"), [blocks]);
  const story = useMemo(() => pickBlock(blocks as Block[] | undefined, "home_story_excerpt"), [blocks]);
  const quality = useMemo(() => pickBlock(blocks as Block[] | undefined, "home_quality_strip"), [blocks]);

  const heroMeta = (hero?.metadata ?? {}) as Record<string, string>;
  const heroVideoUrl = typeof heroMeta.videoUrl === "string" ? heroMeta.videoUrl : null;
  const heroImage = hero?.imageUrl ? imgSrc(hero.imageUrl) : heroImg;
  const heroTitle = hero?.titleAr || "إرث دمشقي أصيل";
  const heroBody =
    hero?.bodyAr ||
    "نصنع الحلويات الشرقية بشغف وإتقان. ننتقي أفضل حبات الفستق الحلبي، ونعجنها بماء الزهر والسمن العربي الأصيل لنقدم لك طعماً لا ينسى.";
  const ctaPrimaryLabel = heroMeta.ctaPrimary || "تسوق الآن";
  const ctaPrimaryHref = heroMeta.ctaPrimaryHref || "/shop";
  const ctaSecondaryLabel = heroMeta.ctaSecondary || "";
  const ctaSecondaryHref = heroMeta.ctaSecondaryHref || "/story";

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative w-full h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 w-full h-full">
          {heroVideoUrl ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover object-center"
              src={imgSrc(heroVideoUrl)}
              poster={heroImage}
              data-testid="video-hero"
            />
          ) : (
            <img
              src={heroImage}
              alt={heroTitle}
              className="w-full h-full object-cover object-center"
              data-testid="img-hero"
            />
          )}
          <div className="absolute inset-0 bg-black/60 bg-gradient-to-t from-background via-black/40 to-transparent" />
        </div>

        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white mb-6 animate-in fade-in slide-in-from-bottom-8 duration-1000"
            data-testid="text-hero-title"
          >
            {heroTitle}
          </h1>
          <p
            className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150"
            data-testid="text-hero-body"
          >
            {heroBody}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <Button
              size="lg"
              className="h-14 px-8 text-base font-medium rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
              asChild
            >
              <Link href={ctaPrimaryHref} data-testid="link-hero-cta-primary">
                {ctaPrimaryLabel}
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Link>
            </Button>
            {ctaSecondaryLabel && (
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-base font-medium rounded-none bg-transparent text-white border-white/70 hover:bg-white/10"
                asChild
              >
                <Link href={ctaSecondaryHref} data-testid="link-hero-cta-secondary">
                  {ctaSecondaryLabel}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Quality strip (CMS) */}
      {quality && (quality.titleAr || quality.bodyAr) && (
        <section className="bg-primary/10 border-y border-primary/20 py-4">
          <div className="container mx-auto px-4 text-center">
            {quality.titleAr && (
              <span className="font-serif font-bold text-primary ml-2" data-testid="text-quality-title">
                {quality.titleAr}:
              </span>
            )}
            <span className="text-foreground/80 text-sm" data-testid="text-quality-body">
              {quality.bodyAr}
            </span>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">تشكيلتنا الفاخرة</h2>
            <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {categories?.slice(0, 4).map((category) => (
              <Link key={category.id} href={`/shop?category=${category.slug}`}>
                <div className="group relative aspect-square overflow-hidden cursor-pointer rounded-lg bg-muted">
                  {category.imageUrl && (
                    <img
                      src={imgSrc(category.imageUrl)}
                      alt={category.nameAr}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity group-hover:opacity-90" />
                  <div className="absolute inset-0 p-6 flex flex-col justify-end">
                    <h3 className="text-xl font-serif font-bold text-white mb-2">{category.nameAr}</h3>
                    {category.descriptionAr && (
                      <p className="text-white/80 text-sm line-clamp-2 opacity-0 translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                        {category.descriptionAr}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Story excerpt (CMS) */}
      {story && (story.titleAr || story.bodyAr) && (
        <section className="py-20 bg-card">
          <div className="container mx-auto px-4 sm:px-8 max-w-3xl text-center">
            {story.titleAr && (
              <h2
                className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4"
                data-testid="text-story-title"
              >
                {story.titleAr}
              </h2>
            )}
            <div className="h-1 w-20 bg-primary mx-auto rounded-full mb-6" />
            {story.bodyAr && (
              <p
                className="text-foreground/80 leading-relaxed text-base md:text-lg whitespace-pre-line"
                data-testid="text-story-body"
              >
                {story.bodyAr}
              </p>
            )}
            <div className="mt-8">
              <Button
                variant="outline"
                className="rounded-none"
                asChild
              >
                <Link href="/story">
                  اقرأ القصة كاملة
                  <ArrowLeft className="mr-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featuredProducts && featuredProducts.length > 0 && (
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 sm:px-8">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">الأكثر طلباً</h2>
                <div className="h-1 w-20 bg-primary rounded-full" />
              </div>
              <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10" asChild>
                <Link href="/shop">
                  عرض الكل
                  <ArrowLeft className="mr-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProducts.slice(0, 6).map((product) => (
                <Link key={product.id} href={`/product/${product.slug}`}>
                  <Card className="h-full overflow-hidden border-border/40 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-card group cursor-pointer">
                    <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                      {product.imageUrl && (
                        <img
                          src={imgSrc(product.imageUrl)}
                          alt={product.nameAr}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <CardContent className="p-6 text-center">
                      <span className="text-xs font-medium text-muted-foreground mb-2 block">{product.categoryNameAr}</span>
                      <h3 className="text-lg font-bold font-serif mb-2 text-foreground group-hover:text-primary transition-colors">{product.nameAr}</h3>
                      <div className="flex justify-center items-center gap-2 text-sm text-primary font-medium" dir="ltr">
                        <span>{new Intl.NumberFormat("ar-SY").format(product.priceMinor)}</span>
                        <span>ل.س</span>
                        <span className="text-muted-foreground font-normal text-xs">/ {product.unit}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
