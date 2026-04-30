import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { imgSrc } from "@/lib/imgSrc";
import { useCurrencySymbol } from "@/lib/format";

export interface FeaturedProductItem {
  id: string;
  slug: string;
  nameAr: string;
  categoryNameAr?: string | null;
  imageUrl?: string | null;
  priceMinor: number;
  unit?: string | null;
}

export interface FeaturedProductsSectionProps {
  title?: string;
  ctaLabel?: string;
  ctaHref?: string;
  eyebrow?: string;
  products: FeaturedProductItem[];
}

export default function FeaturedProductsSection({
  title,
  ctaLabel,
  ctaHref = "/shop",
  eyebrow,
  products,
}: FeaturedProductsSectionProps) {
  const currencySymbol = useCurrencySymbol();
  if (!title || products.length === 0) return null;

  return (
    <section
      className="relative py-28 md:py-36 bg-background overflow-hidden"
      data-testid="section-featured"
    >
      <div className="container mx-auto px-4 sm:px-8">
        <motion.div
          className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            {eyebrow && (
              <span className="block text-xs tracking-[0.4em] uppercase text-primary/70 mb-4 font-medium">
                {eyebrow}
              </span>
            )}
            <h2
              className="text-3xl md:text-5xl font-serif font-bold text-foreground leading-tight"
              data-testid="text-featured-title"
            >
              {title}
            </h2>
            <div className="h-[2px] w-16 bg-primary rounded-full mt-6" />
          </div>
          {ctaLabel && (
            <Button
              variant="ghost"
              className="text-primary hover:text-primary hover:bg-primary/10 self-start md:self-auto"
              asChild
            >
              <Link href={ctaHref} data-testid="link-featured-cta">
                {ctaLabel}
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.slice(0, 6).map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.85,
                ease: [0.22, 1, 0.36, 1],
                delay: (idx % 3) * 0.1,
              }}
            >
              <Link href={`/product/${product.slug}`}>
                <Card className="h-full overflow-hidden border-border/30 hover:border-primary/40 transition-all duration-500 hover:shadow-xl hover:-translate-y-1 bg-card group cursor-pointer rounded-2xl">
                  <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                    {product.imageUrl && (
                      <motion.img
                        src={imgSrc(product.imageUrl)}
                        alt={product.nameAr}
                        className="w-full h-full object-cover"
                        whileHover={{ scale: 1.06 }}
                        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                  </div>
                  <CardContent className="p-7 text-center">
                    {product.categoryNameAr && (
                      <span className="text-xs font-medium text-muted-foreground/80 tracking-wider uppercase mb-3 block">
                        {product.categoryNameAr}
                      </span>
                    )}
                    <h3 className="text-lg md:text-xl font-bold font-serif mb-3 text-foreground group-hover:text-primary transition-colors">
                      {product.nameAr}
                    </h3>
                    <div
                      className="flex justify-center items-baseline gap-2 text-sm text-primary font-medium"
                      dir="ltr"
                    >
                      <span className="text-base">
                        {new Intl.NumberFormat(["ar-PS", "ar"]).format(product.priceMinor)}
                      </span>
                      <span>{currencySymbol}</span>
                      {product.unit && (
                        <span className="text-muted-foreground font-normal text-xs">
                          / {product.unit}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
