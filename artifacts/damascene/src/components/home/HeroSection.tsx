import { Link } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imgSrc } from "@/lib/imgSrc";
import heroImg from "@/assets/hero.png";

export interface HeroSectionProps {
  title?: string;
  body?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  ctaPrimaryLabel?: string;
  ctaPrimaryHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
}

export default function HeroSection({
  title,
  body,
  imageUrl,
  videoUrl,
  ctaPrimaryLabel,
  ctaPrimaryHref = "/shop",
  ctaSecondaryLabel,
  ctaSecondaryHref = "/about",
}: HeroSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const mediaY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 0.5, 0]);

  const resolvedImage = imageUrl ? imgSrc(imageUrl) : heroImg;
  const resolvedVideo = videoUrl ? imgSrc(videoUrl) : null;

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
        {resolvedVideo ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover object-center"
            src={resolvedVideo}
            poster={resolvedImage}
            data-testid="video-hero"
          />
        ) : (
          <img
            src={resolvedImage}
            alt={title ?? ""}
            className="w-full h-full object-cover object-center"
            data-testid="img-hero"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/85" />
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
