import { useMemo } from "react";
import {
  useListFeaturedProducts,
  useListPublicCategories,
  useListContentBlocks,
} from "@workspace/api-client-react";
import type { ContentBlock } from "@workspace/api-client-react";

import HeroSection, { type HeroMediaType } from "@/components/home/HeroSection";
import QualitySection from "@/components/home/QualitySection";
import ProductStorySection from "@/components/home/ProductStorySection";
import BrandStorySection from "@/components/home/BrandStorySection";
import FeaturedProductsSection from "@/components/home/FeaturedProductsSection";
import CTASection from "@/components/home/CTASection";

type BlockMeta = Record<string, unknown>;

function pickBlock(blocks: ContentBlock[] | undefined, key: string): ContentBlock | undefined {
  return blocks?.find((b) => b.key === key);
}

function metaString(meta: BlockMeta, k: string): string | undefined {
  const v = meta[k];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function metaNumber(meta: BlockMeta, k: string): number | undefined {
  const v = meta[k];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function blockMeta(b: ContentBlock | undefined): BlockMeta {
  return ((b as unknown as { metadata?: BlockMeta })?.metadata ?? {}) as BlockMeta;
}

export default function HomePage() {
  const { data: categories } = useListPublicCategories();
  const { data: featuredProducts } = useListFeaturedProducts();
  const { data: blocks } = useListContentBlocks({ page: "home" });

  const hero = useMemo(() => pickBlock(blocks, "home_hero"), [blocks]);
  const story = useMemo(() => pickBlock(blocks, "home_story_excerpt"), [blocks]);
  const quality = useMemo(() => pickBlock(blocks, "home_quality_strip"), [blocks]);
  const categoriesBlock = useMemo(() => pickBlock(blocks, "home_categories_section"), [blocks]);
  const featuredBlock = useMemo(() => pickBlock(blocks, "home_featured_section"), [blocks]);
  const ctaBlock = useMemo(() => pickBlock(blocks, "home_cta"), [blocks]);

  const heroMeta = blockMeta(hero);
  const heroVideoUrl = metaString(heroMeta, "videoUrl") ?? null;
  const heroFallbackUrl = metaString(heroMeta, "fallbackImageUrl") ?? null;
  const heroMediaTypeRaw = metaString(heroMeta, "mediaType");
  const heroMediaType: HeroMediaType | undefined =
    heroMediaTypeRaw === "video" || heroMediaTypeRaw === "image"
      ? heroMediaTypeRaw
      : undefined;
  const heroOverlay = metaNumber(heroMeta, "overlayOpacity");
  const heroAlt = metaString(heroMeta, "alt");
  const heroCtaSecondary = metaString(heroMeta, "ctaSecondary");
  const heroCtaSecondaryHref = metaString(heroMeta, "ctaSecondaryHref") ?? "/about";

  const storyMeta = blockMeta(story);
  const storyImageUrl = story?.imageUrl ?? metaString(storyMeta, "imageUrl") ?? null;
  const storyVideoUrl = metaString(storyMeta, "videoUrl") ?? null;
  const storyMobileImageUrl = metaString(storyMeta, "mobileImageUrl") ?? null;
  const storyMobileVideoUrl = metaString(storyMeta, "mobileVideoUrl") ?? null;
  const storyAlt = metaString(storyMeta, "alt");

  const ctaMeta = blockMeta(ctaBlock);
  const ctaSecondaryLabelFinal = ctaBlock ? metaString(ctaMeta, "ctaSecondary") : undefined;
  const ctaSecondaryHrefFinal = metaString(ctaMeta, "ctaSecondaryHref") ?? "/contact";

  return (
    <div className="w-full">
      {hero && (
        <HeroSection
          title={hero.titleAr ?? undefined}
          body={hero.contentAr ?? undefined}
          imageUrl={hero.imageUrl ?? null}
          videoUrl={heroVideoUrl}
          fallbackImageUrl={heroFallbackUrl}
          mediaType={heroMediaType}
          overlayOpacity={heroOverlay}
          alt={heroAlt}
          ctaPrimaryLabel={hero.ctaLabel ?? undefined}
          ctaPrimaryHref={hero.ctaHref || "/shop"}
          ctaSecondaryLabel={heroCtaSecondary}
          ctaSecondaryHref={heroCtaSecondaryHref}
        />
      )}

      <QualitySection
        title={quality?.titleAr ?? undefined}
        body={quality?.contentAr ?? undefined}
      />

      <ProductStorySection
        title={categoriesBlock?.titleAr ?? undefined}
        subtitle={categoriesBlock?.contentAr ?? undefined}
        categories={(categories ?? []).map((c) => ({
          id: c.id,
          slug: c.slug,
          nameAr: c.nameAr,
          descriptionAr: c.descriptionAr ?? null,
          imageUrl: c.imageUrl ?? null,
        }))}
      />

      <BrandStorySection
        title={story?.titleAr ?? undefined}
        body={story?.contentAr ?? undefined}
        ctaLabel={story?.ctaLabel ?? undefined}
        ctaHref={story?.ctaHref ?? "/about"}
        imageUrl={storyImageUrl}
        videoUrl={storyVideoUrl}
        mobileImageUrl={storyMobileImageUrl}
        mobileVideoUrl={storyMobileVideoUrl}
        alt={storyAlt}
      />

      <FeaturedProductsSection
        title={featuredBlock?.titleAr ?? undefined}
        ctaLabel={featuredBlock?.ctaLabel ?? undefined}
        ctaHref={featuredBlock?.ctaHref || "/shop"}
        products={(featuredProducts ?? []).map((p) => ({
          id: p.id,
          slug: p.slug,
          nameAr: p.nameAr,
          categoryNameAr: p.categoryNameAr ?? null,
          imageUrl: p.imageUrl ?? null,
          priceMinor: p.priceMinor,
          unit: p.unit ?? null,
        }))}
      />

      <CTASection
        title={ctaBlock?.titleAr ?? undefined}
        body={ctaBlock?.contentAr ?? undefined}
        ctaPrimaryLabel={ctaBlock?.ctaLabel ?? undefined}
        ctaPrimaryHref={ctaBlock?.ctaHref ?? undefined}
        ctaSecondaryLabel={ctaSecondaryLabelFinal}
        ctaSecondaryHref={ctaSecondaryHrefFinal}
      />
    </div>
  );
}
