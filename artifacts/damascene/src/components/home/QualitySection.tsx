import { motion } from "framer-motion";

export interface QualitySectionProps {
  title?: string;
  body?: string;
}

export default function QualitySection({ title, body }: QualitySectionProps) {
  if (!title && !body) return null;
  return (
    <section
      className="relative bg-gradient-to-b from-[hsl(40_33%_97%)] to-background py-10 border-y border-primary/10"
      data-testid="section-quality"
    >
      <div className="container mx-auto px-4">
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {title && (
            <span
              className="font-serif font-bold text-primary text-lg sm:text-xl tracking-wide"
              data-testid="text-quality-title"
            >
              {title}
            </span>
          )}
          {title && body && (
            <span className="hidden sm:inline-block h-6 w-px bg-primary/30" aria-hidden />
          )}
          {body && (
            <span
              className="text-foreground/75 text-sm sm:text-base leading-relaxed"
              data-testid="text-quality-body"
            >
              {body}
            </span>
          )}
        </motion.div>
      </div>
    </section>
  );
}
