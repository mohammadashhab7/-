import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { imgSrc } from "@/lib/imgSrc";

export interface ProductCategoryItem {
  id: string;
  slug: string;
  nameAr: string;
  descriptionAr?: string | null;
  imageUrl?: string | null;
}

export interface ProductStorySectionProps {
  title?: string;
  subtitle?: string;
  categories: ProductCategoryItem[];
}

export default function ProductStorySection({ title, subtitle, categories }: ProductStorySectionProps) {
  if (!title || categories.length === 0) return null;

  return (
    <section className="relative py-28 md:py-36 bg-background overflow-hidden" data-testid="section-product-story">
      <div className="container mx-auto px-4 sm:px-8">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {subtitle && (
            <span className="block text-xs tracking-[0.4em] uppercase text-primary/70 mb-4 font-medium">
              {subtitle}
            </span>
          )}
          <h2
            className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground leading-tight"
            data-testid="text-categories-title"
          >
            {title}
          </h2>
          <div className="h-[2px] w-16 bg-primary mx-auto rounded-full mt-8" />
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {categories.slice(0, 4).map((category, idx) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.85,
                ease: [0.22, 1, 0.36, 1],
                delay: idx * 0.12,
              }}
            >
              <Link href={`/shop?category=${category.slug}`}>
                <div className="group relative aspect-[3/4] overflow-hidden cursor-pointer rounded-2xl bg-muted">
                  {category.imageUrl && (
                    <motion.img
                      src={imgSrc(category.imageUrl)}
                      alt={category.nameAr}
                      className="w-full h-full object-cover"
                      whileHover={{ scale: 1.08 }}
                      transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
                    <h3 className="text-xl md:text-2xl font-serif font-bold text-white mb-2 leading-tight">
                      {category.nameAr}
                    </h3>
                    {category.descriptionAr && (
                      <p className="text-white/85 text-sm leading-relaxed line-clamp-2 mb-4 transition-opacity duration-500 opacity-90">
                        {category.descriptionAr}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-white/90 text-sm font-medium opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-500">
                      <span>اكتشف المجموعة</span>
                      <ArrowLeft className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
