import { Link } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imgSrc } from "@/lib/imgSrc";
import heroImg from "@/assets/hero.png";

export type HeroMediaType = "image" | "video";

export interface HeroSectionProps {
  title?: string;
  body?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  fallbackImageUrl?: string | null;
  mediaType?: HeroMediaType;
  overlayOpacity?: number;
  alt?: string;
  ctaPrimaryLabel?: string;
  ctaPrimaryHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
}

function clampOpacity(o: number | undefined): number {
  if (typeof o !== "number" || !Number.isFinite(o)) return 60;
  if (o < 0) return 0;
  if (o > 100) return 100;
  return o;
}

export default function HeroSection({
  title,
  body,
  imageUrl,
  videoUrl,
  fallbackImageUrl,
  mediaType,
  overlayOpacity,
  alt,
  ctaPrimaryLabel,
  ctaPrimaryHref = "/shop",
  ctaSecondaryLabel,
  ctaSecondaryHref = "/about",
}: HeroSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const mediaY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 0.5, 0]);

  // Image priority: explicit imageUrl, then bundled hero asset.
  const resolvedImage = imageUrl ? imgSrc(imageUrl) : heroImg;
  // Poster/fallback for video: explicit fallbackImageUrl, else the regular image.
  const resolvedFallback = fallbackImageUrl
    ? imgSrc(fallbackImageUrl)
    : resolvedImage;
  const resolvedVideo = videoUrl ? imgSrc(videoUrl) : null;

  const wantsVideo = mediaType === "video" || (!mediaType && !!resolvedVideo);
  const showVideo = wantsVideo && !!resolvedVideo && !videoFailed;

  // Reset failure flag whenever the effective video source changes so a fresh
  // URL gets a clean chance to load instead of silently falling back forever.
  useEffect(() => {
    setVideoFailed(false);
  }, [resolvedVideo]);

  const overlayPct = clampOpacity(overlayOpacity);
  const overlayDecimal = overlayPct / 100;

  return (
    <section
      ref={ref}
      className="relative w-full h-[92vh] min-h-[640px] flex items-center justify-center overflow-hidden bg-black"
      data-testid="section-hero"
    >
      <motion.div
        className="absolute inset-0 w-full h-[120%]"
        style={{ y: mediaY }}
      >
        {showVideo ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover object-center"
            src={resolvedVideo!}
            poster={resolvedFallback}
            aria-label={alt || title || ""}
            onError={() => setVideoFailed(true)}
            data-testid="video-hero"
          />
        ) : (
          <img
            src={resolvedFallback}
            alt={alt || title || ""}
            className="w-full h-full object-cover object-center"
            data-testid="img-hero"
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/80"
          style={{ opacity: 0.35 + overlayDecimal * 0.65 }}
          data-testid="hero-overlay"
        />
      </motion.div>

      <motion.div
        className="relative z-10 container mx-auto px-4 text-center"
        style={{ y: contentY, opacity: contentOpacity }}
      >
        {title && (
          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white mb-6 leading-tight"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            data-testid="text-hero-title"
          >
            {title}
          </motion.h1>
        )}
        {body && (
          <motion.p
            className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            data-testid="text-hero-body"
          >
            {body}
          </motion.p>
        )}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        >
          {ctaPrimaryLabel && (
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
          )}
          {ctaSecondaryLabel && (
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 text-base font-medium rounded-none bg-transparent text-white border-white/70 hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link href={ctaSecondaryHref} data-testid="link-hero-cta-secondary">
                {ctaSecondaryLabel}
              </Link>
            </Button>
          )}
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-white/60 text-xs tracking-[0.3em] uppercase font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
      >
        <div className="flex flex-col items-center gap-2">
          <span>تصفح</span>
          <motion.div
            className="w-px h-10 bg-white/40"
            animate={{ scaleY: [0, 1, 0], originY: 0 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}
