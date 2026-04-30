import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { useGetSettings, useListContentBlocks } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";

type ContactMetadata = {
  hoursAr?: string;
  mapEmbedUrl?: string;
  mapImageUrl?: string;
};

export default function ContactPage() {
  const { data: settings, isPending: settingsPending } = useGetSettings();
  const { data: blocks } = useListContentBlocks({ page: "contact" });
  const settingsLoaded = !settingsPending;
  const heroBlock = blocks?.find((b) => b.key === "contact_hero" || b.key === "contact_main");
  const visitBlock = blocks?.find((b) => b.key === "contact_visit");
  const contactMeta = (heroBlock?.metadata ?? {}) as ContactMetadata;
  const visitMeta = (visitBlock?.metadata ?? {}) as ContactMetadata;
  const mapEmbedUrl = contactMeta.mapEmbedUrl ?? visitMeta.mapEmbedUrl;
  const mapImageUrl = contactMeta.mapImageUrl ?? visitMeta.mapImageUrl;
  const hoursAr = contactMeta.hoursAr ?? visitMeta.hoursAr;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-16">
      {(heroBlock?.titleAr || heroBlock?.contentAr) && (
        <header className="text-center mb-12">
          {heroBlock.titleAr && (
            <h1 className="font-serif text-4xl md:text-5xl text-primary mb-4">{heroBlock.titleAr}</h1>
          )}
          {heroBlock.contentAr && (
            <p className="text-foreground/70 text-lg whitespace-pre-line">{heroBlock.contentAr}</p>
          )}
        </header>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-1" />
              <div>
                <div className="font-medium">العنوان</div>
                <div className="text-foreground/70">
                  {settingsLoaded ? (
                    settings?.addressAr || "—"
                  ) : (
                    <span className="inline-block h-4 w-40 rounded bg-muted/70 align-middle animate-pulse" aria-hidden />
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-primary mt-1" />
              <div>
                <div className="font-medium">الهاتف</div>
                <div className="text-foreground/70 ltr-numbers">
                  {settingsLoaded ? (
                    settings?.phone || "—"
                  ) : (
                    <span className="inline-block h-4 w-32 rounded bg-muted/70 align-middle animate-pulse" aria-hidden />
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-1" />
              <div>
                <div className="font-medium">البريد الإلكتروني</div>
                <div className="text-foreground/70">
                  {settingsLoaded ? (
                    settings?.email || "—"
                  ) : (
                    <span className="inline-block h-4 w-44 rounded bg-muted/70 align-middle animate-pulse" aria-hidden />
                  )}
                </div>
              </div>
            </div>
            {hoursAr && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary mt-1" />
                <div>
                  <div className="font-medium">ساعات العمل</div>
                  <div className="text-foreground/70 whitespace-pre-line">{hoursAr}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            {visitBlock?.titleAr && (
              <h2 className="font-serif text-2xl text-primary mb-4">{visitBlock.titleAr}</h2>
            )}
            {visitBlock?.contentAr && (
              <p className="text-foreground/70 leading-relaxed whitespace-pre-line">
                {visitBlock.contentAr}
              </p>
            )}
            {mapEmbedUrl ? (
              <div className="mt-6 aspect-video rounded-lg overflow-hidden">
                <iframe
                  title="map"
                  src={mapEmbedUrl}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : mapImageUrl ? (
              <div className="mt-6 aspect-video rounded-lg overflow-hidden">
                <img src={mapImageUrl} alt="map" className="w-full h-full object-cover" />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
