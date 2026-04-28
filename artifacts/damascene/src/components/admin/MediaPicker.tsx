import { useMemo, useRef, useState } from "react";
import {
  useListMedia,
  useGetMediaUploadUrl,
  useCreateMedia,
  getListMediaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, X, Image as ImageIcon, Film } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { imgSrc } from "@/lib/imgSrc";

export type MediaKindFilter = "image" | "video" | "any";

interface MediaPickerProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  kind?: MediaKindFilter;
  placeholder?: string;
  helperText?: string;
  testId?: string;
}

export default function MediaPicker({
  label,
  value,
  onChange,
  kind = "image",
  placeholder,
  helperText,
  testId,
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5" data-testid={testId}>
      <Label>{label}</Label>
      <div className="flex items-stretch gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? (kind === "video" ? "/objects/.../video.mp4" : "/objects/.../image.jpg")}
          className="flex-1 ltr-numbers"
          dir="ltr"
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" data-testid={testId ? `${testId}-open` : undefined}>
              {kind === "video" ? <Film className="h-4 w-4 ml-2" /> : <ImageIcon className="h-4 w-4 ml-2" />}
              اختيار
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>اختر {kind === "video" ? "فيديو" : kind === "image" ? "صورة" : "ملف"}</DialogTitle>
            </DialogHeader>
            <MediaPickerBody
              kind={kind}
              onSelect={(url) => {
                onChange(url);
                setOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            aria-label="مسح"
            data-testid={testId ? `${testId}-clear` : undefined}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
      {value && <MediaPreview url={value} kind={kind} />}
    </div>
  );
}

function MediaPreview({ url, kind }: { url: string; kind: MediaKindFilter }) {
  const src = imgSrc(url) ?? url;
  const isVideo =
    kind === "video" ||
    /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url);
  return (
    <div className="mt-2 border rounded-md overflow-hidden bg-muted/30 max-w-xs">
      {isVideo ? (
        <video
          src={src}
          className="w-full h-32 object-cover bg-black"
          muted
          loop
          playsInline
          autoPlay
          data-testid="media-preview-video"
        />
      ) : (
        <img
          src={src}
          alt="معاينة"
          className="w-full h-32 object-cover"
          data-testid="media-preview-image"
        />
      )}
    </div>
  );
}

function MediaPickerBody({
  kind,
  onSelect,
}: {
  kind: MediaKindFilter;
  onSelect: (url: string) => void;
}) {
  const { data: media, refetch } = useListMedia();
  const getUrl = useGetMediaUploadUrl();
  const create = useCreateMedia();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const filtered = useMemo(() => {
    if (!media) return [];
    if (kind === "any") return media;
    return media.filter((m) => m.kind === kind);
  }, [media, kind]);

  const acceptAttr =
    kind === "video" ? "video/*" : kind === "image" ? "image/*" : undefined;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { uploadURL } = await getUrl.mutateAsync();
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      const detectedKind = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
        ? "video"
        : "document";
      const created = await create.mutateAsync({
        data: { name: file.name, uploadURL, kind: detectedKind },
      });
      qc.invalidateQueries({ queryKey: getListMediaQueryKey() });
      await refetch();
      toast({ title: "تم رفع الملف" });
      onSelect(created.url);
    } catch (e: unknown) {
      const description = e instanceof Error ? e.message : undefined;
      toast({ title: "تعذّر الرفع", description, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Tabs defaultValue="library" className="flex-1 flex flex-col overflow-hidden">
      <TabsList>
        <TabsTrigger value="library">المكتبة</TabsTrigger>
        <TabsTrigger value="upload">رفع جديد</TabsTrigger>
      </TabsList>
      <TabsContent value="library" className="flex-1 overflow-auto mt-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            لا توجد {kind === "video" ? "فيديوهات" : "صور"} في المكتبة بعد. ارفع ملفًا جديدًا.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-3">
            {filtered.map((m) => {
              const previewSrc = imgSrc(m.url) ?? m.url;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => onSelect(m.url)}
                  className="border rounded-md overflow-hidden text-right hover:border-primary hover:shadow-md transition-all bg-card"
                  data-testid={`media-pick-${m.id}`}
                >
                  {m.kind === "video" ? (
                    <video
                      src={previewSrc}
                      className="w-full h-28 object-cover bg-black"
                      muted
                      playsInline
                    />
                  ) : m.kind === "image" ? (
                    <img src={previewSrc} alt={m.name} className="w-full h-28 object-cover" />
                  ) : (
                    <div className="w-full h-28 bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      ملف
                    </div>
                  )}
                  <div className="p-2">
                    <div className="text-xs font-medium truncate" title={m.name}>
                      {m.name || "—"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </TabsContent>
      <TabsContent value="upload" className="flex-1 overflow-auto mt-3">
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <input
            ref={fileInput}
            type="file"
            hidden
            accept={acceptAttr}
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <Button
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            size="lg"
            data-testid="media-upload-button"
          >
            <Upload className="ml-2 h-4 w-4" />
            {uploading
              ? "جاري الرفع..."
              : kind === "video"
              ? "اختر ملف فيديو من جهازك"
              : "اختر صورة من جهازك"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {kind === "video"
              ? "صيغ مدعومة: MP4, WebM. ينصح بحجم لا يتجاوز ٢٠ ميجابايت لأداء أفضل."
              : "صيغ مدعومة: JPG, PNG, WebP."}
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
