import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CTASectionProps {
  title?: string;
  body?: string;
  ctaPrimaryLabel?: string;
  ctaPrimaryHref?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryHref?: string;
  eyebrow?: string;
}

export default function CTASection({
  title,
  body,
  ctaPrimaryLabel,
  ctaPrimaryHref = "/shop",
  ctaSecondaryLabel,
  ctaSecondaryHref = "/contact",
  eyebrow,
}: CTASectionProps) {
  // Render only when the CMS block actually has copy. The CTA section's whole
  // purpose is the headline + body invitation; without those, button-only
  // markup would just look like a stray pair of buttons. Stay hidden until
  // the saved CMS title and body both arrive.
  if (!title || !body) return null;

  return (
    <section
      className="relative py-28 md:py-40 bg-gradient-to-br from-primary via-primary to-[hsl(var(--primary)/0.85)] overflow-hidden"
      data-testid="section-cta"
    >
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
          backgroundSize: "60px 60px, 80px 80px",
        }}
      />

      <motion.div
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="container mx-auto px-4 sm:px-8 relative z-10">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {eyebrow && (
            <span className="block text-xs tracking-[0.4em] uppercase text-primary-foreground/70 mb-5 font-medium">
              {eyebrow}
            </span>
          )}
          {title && (
            <h2
              className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-primary-foreground mb-6 leading-tight"
              data-testid="text-cta-title"
            >
              {title}
            </h2>
          )}
          {body && (
            <p
              className="text-base md:text-lg text-primary-foreground/85 leading-relaxed mb-10 max-w-2xl mx-auto"
              data-testid="text-cta-body"
            >
              {body}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {ctaPrimaryLabel && (
              <Button
                size="lg"
                className="h-14 px-10 text-base font-medium rounded-none bg-background text-foreground hover:bg-background/90"
                asChild
              >
                <Link href={ctaPrimaryHref} data-testid="link-cta-primary">
                  {ctaPrimaryLabel}
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Link>
              </Button>
            )}
            {ctaSecondaryLabel && (
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-10 text-base font-medium rounded-none bg-transparent text-primary-foreground border-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                asChild
              >
                <Link href={ctaSecondaryHref} data-testid="link-cta-secondary">
                  {ctaSecondaryLabel}
                </Link>
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
