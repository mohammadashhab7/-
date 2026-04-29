import { Link } from "wouter";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imgSrc } from "@/lib/imgSrc";
import heroImg from "@/assets/hero.png";

export type HeroMediaType = "image" | "video" | "slider";

export interface HeroSlide {
  imageUrl: string;
  alt?: string;
}

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
  slides?: HeroSlide[];
  sliderInterval?: number;
  sliderTransition?: number;
  sliderShowDots?: boolean;
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
  slides = [],
  sliderInterval = 5000,
  sliderTransition = 800,
  sliderShowDots = true,
}: HeroSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const mediaY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 0.5, 0]);

  const resolvedImage = imageUrl ? imgSrc(imageUrl) : heroImg;
  const resolvedFallback = fallbackImageUrl ? imgSrc(fallbackImageUrl) : resolvedImage;
  const resolvedVideo = videoUrl ? imgSrc(videoUrl) : null;

  const wantsVideo = mediaType === "video" || (!mediaType && !!resolvedVideo);
  const showVideo = wantsVideo && !!resolvedVideo && !videoFailed;

  const validSlides = slides.filter((s) => s.imageUrl);
  const isSlider = mediaType === "slider" && validSlides.length > 0;
  const slideCount = validSlides.length;
  const transitionSec = Math.max(0.1, (sliderTransition ?? 800) / 1000);

  useEffect(() => {
    setVideoFailed(false);
  }, [resolvedVideo]);

  // Reset index only when slide URLs actually change, not on every render
  // (slides prop gets a new array reference each render from Home.tsx)
  const slidesKey = validSlides.map((s) => s.imageUrl).join("|");
  useEffect(() => {
    setCurrentIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slidesKey]);

  useEffect(() => {
    if (!isSlider || slideCount <= 1 || paused) return;
    const id = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % slideCount);
    }, Math.max(1000, sliderInterval ?? 5000));
    return () => clearInterval(id);
  }, [isSlider, slideCount, paused, sliderInterval]);

  const overlayPct = clampOpacity(overlayOpacity);
  const overlayDecimal = overlayPct / 100;

  return (
    <section
      ref={ref}
      className="relative w-full h-[92vh] min-h-[640px] flex items-center justify-center overflow-hidden bg-black"
      data-testid="section-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <motion.div
        className="absolute inset-0 w-full h-[120%]"
        style={{ y: mediaY }}
      >
        {isSlider ? (
          <div className="relative w-full h-full">
            <AnimatePresence initial={false}>
              {(() => {
                const safeIdx = slideCount ? currentIndex % slideCount : 0;
                const slide = validSlides[safeIdx];
                if (!slide) return null;
                return (
                  <motion.img
                    key={safeIdx}
                    src={imgSrc(slide.imageUrl)}
                    alt={slide.alt || alt || title || ""}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: transitionSec, ease: "easeInOut" }}
                    data-testid="img-hero"
                  />
                );
              })()}
            </AnimatePresence>
          </div>
        ) : showVideo ? (
          <video
            key={resolvedVideo}
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

      {isSlider && sliderShowDots && slideCount > 1 && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex gap-2.5"
          data-testid="slider-dots"
        >
          {validSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              aria-label={`الشريحة ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-500 ${
                i === currentIndex
                  ? "w-6 bg-white"
                  : "w-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}

      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-white/60 text-xs tracking-[0.3em] uppercase font-medium"
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
