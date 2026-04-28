import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imgSrc } from "@/lib/imgSrc";
import atelierImg from "@/assets/atelier.png";

export interface BrandStorySectionProps {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  mobileImageUrl?: string | null;
  mobileVideoUrl?: string | null;
  alt?: string;
  eyebrow?: string;
}

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpointPx]);
  return isMobile;
}

export default function BrandStorySection({
  title,
  body,
  ctaLabel,
  ctaHref,
  imageUrl,
  videoUrl,
  mobileImageUrl,
  mobileVideoUrl,
  alt,
  eyebrow = "حكاية الدمشقي",
}: BrandStorySectionProps) {
  const ref = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  const [videoFailed, setVideoFailed] = useState(false);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.05, 1, 1.05]);

  // Choose image / video per viewport. Fall back to desktop variants if mobile
  // counterparts aren't set, then to bundled atelier asset for image.
  const chosenImageUrl = isMobile && mobileImageUrl ? mobileImageUrl : imageUrl;
  const chosenVideoUrl = isMobile && mobileVideoUrl ? mobileVideoUrl : videoUrl;

  const resolvedImage = chosenImageUrl ? imgSrc(chosenImageUrl) : atelierImg;
  const resolvedVideo = chosenVideoUrl ? imgSrc(chosenVideoUrl) : null;

  // Reset failure flag whenever the chosen video URL changes (e.g. switching
  // between desktop and mobile variants) so a fresh source isn't permanently
  // blocked by an earlier failure. Must run before any conditional early-return
  // to keep hook order stable.
  useEffect(() => {
    setVideoFailed(false);
  }, [resolvedVideo]);

  if (!title && !body) return null;

  const showVideo = !!resolvedVideo && !videoFailed;
  const altText = alt || title || "";

  return (
    <section
      ref={ref}
      className="relative py-28 md:py-40 bg-[hsl(35_30%_96%)] overflow-hidden"
      data-testid="section-brand-story"
    >
      <div className="container mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <motion.div
            className="lg:col-span-6 order-2 lg:order-1"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            {eyebrow && (
              <span className="block text-xs tracking-[0.4em] uppercase text-primary/70 mb-5 font-medium">
                {eyebrow}
              </span>
            )}
            {title && (
              <h2
                className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-8 leading-tight"
                data-testid="text-story-title"
              >
                {title}
              </h2>
            )}
            <div className="h-[2px] w-16 bg-primary rounded-full mb-8" />
            {body && (
              <p
                className="text-foreground/75 leading-loose text-base md:text-lg whitespace-pre-line max-w-xl"
                data-testid="text-story-body"
              >
                {body}
              </p>
            )}
            {ctaLabel && (
              <div className="mt-10">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-none border-primary/40 hover:border-primary text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                  asChild
                >
                  <Link href={ctaHref || "/about"} data-testid="link-story-cta">
                    {ctaLabel}
                    <ArrowLeft className="mr-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </motion.div>

          <motion.div
            className="lg:col-span-6 order-1 lg:order-2"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted shadow-2xl">
              {showVideo ? (
                <motion.video
                  src={resolvedVideo!}
                  poster={resolvedImage}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-[120%] object-cover"
                  style={{ y: imageY, scale: imageScale }}
                  aria-label={altText}
                  onError={() => setVideoFailed(true)}
                  data-testid="video-story"
                />
              ) : (
                <motion.img
                  src={resolvedImage}
                  alt={altText}
                  className="w-full h-[120%] object-cover"
                  style={{ y: imageY, scale: imageScale }}
                  data-testid="img-story"
                />
              )}
              <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-2xl" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
