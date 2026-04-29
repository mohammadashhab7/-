import { useCallback, useMemo, useRef, useState } from "react";
import {
  useListMedia,
  useGetMediaUploadUrl,
  useCreateMedia,
  getListMediaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Image as ImageIcon, Film, Upload, X, CloudUpload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { imgSrc } from "@/lib/imgSrc";
import ImageCropEditor from "./ImageCropEditor";

export type MediaKindFilter = "image" | "video" | "any";

interface MediaPickerProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  kind?: MediaKindFilter;
  helperText?: string;
  testId?: string;
}

export default function MediaPicker({
  label,
  value,
  onChange,
  kind = "image",
  helperText,
  testId,
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const resolved = value ? imgSrc(value) : null;
  const isVideo =
    kind === "video" || /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(value ?? "");

  return (
    <div className="space-y-1.5" data-testid={testId}>
      <Label>{label}</Label>

      <div className="flex items-start gap-2">
        <div className="flex-1 border-2 border-dashed border-border rounded-lg overflow-hidden bg-muted/20 min-h-[80px] flex items-center justify-center relative">
          {resolved ? (
            <>
              {isVideo ? (
                <video
                  src={resolved}
                  className="w-full h-24 object-cover"
                  muted
                  playsInline
                  data-testid="media-preview-video"
                />
              ) : (
                <img
                  src={resolved}
                  alt=""
                  className="w-full h-24 object-cover"
                  data-testid="media-preview-image"
                />
              )}
              <button
                type="button"
                className="absolute top-1 left-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80 transition-colors"
                onClick={() => onChange("")}
                aria-label="مسح"
                data-testid={testId ? `${testId}-clear` : undefined}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground py-4 px-2 text-center">
              {kind === "video" ? (
                <Film className="h-6 w-6 opacity-40" />
              ) : (
                <ImageIcon className="h-6 w-6 opacity-40" />
              )}
              <span className="text-xs">
                {kind === "video" ? "لم يُختر فيديو" : "لم تُختر صورة"}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid={testId ? `${testId}-open` : undefined}
              >
                {resolved ? "تغيير" : "اختيار"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  اختر {kind === "video" ? "فيديو" : kind === "image" ? "صورة" : "ملف"}
                </DialogTitle>
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
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onChange("")}
              data-testid={testId ? `${testId}-clear` : undefined}
            >
              <X className="h-3.5 w-3.5 ml-1" />
              مسح
            </Button>
          )}
        </div>
      </div>

      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
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
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const filtered = useMemo(() => {
    if (!media) return [];
    if (kind === "any") return media;
    return media.filter((m) => m.kind === kind);
  }, [media, kind]);

  const acceptAttr =
    kind === "video" ? "video/*" : kind === "image" ? "image/*" : undefined;

  const doUpload = useCallback(
    async (blob: Blob, name: string) => {
      setUploading(true);
      setCropFile(null);
      try {
        const { uploadURL } = await getUrl.mutateAsync();
        const put = await fetch(uploadURL, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": blob.type || "image/jpeg" },
        });
        if (!put.ok) throw new Error(`فشل رفع الملف (${put.status})`);
        const detectedKind: "image" | "video" | "document" = blob.type.startsWith("image/")
          ? "image"
          : blob.type.startsWith("video/")
          ? "video"
          : "document";
        const created = await create.mutateAsync({
          data: { name, uploadURL, kind: detectedKind },
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
    },
    [getUrl, create, qc, refetch, toast, onSelect]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (file.type.startsWith("image/")) {
        setCropFile(file);
      } else {
        doUpload(file, file.name);
      }
    },
    [doUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (cropFile) {
    return (
      <div className="flex-1 overflow-auto py-2">
        <ImageCropEditor
          file={cropFile}
          onConfirm={(blob, name) => doUpload(blob, name)}
          onCancel={() => setCropFile(null)}
        />
      </div>
    );
  }

  return (
    <Tabs defaultValue="library" className="flex-1 flex flex-col overflow-hidden">
      <TabsList>
        <TabsTrigger value="library">المكتبة</TabsTrigger>
        <TabsTrigger value="upload">رفع جديد</TabsTrigger>
      </TabsList>

      <TabsContent value="library" className="flex-1 overflow-auto mt-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            لا توجد {kind === "video" ? "فيديوهات" : "صور"} في المكتبة بعد.
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
                  className="border rounded-md overflow-hidden text-right hover:border-primary hover:shadow-md transition-all bg-card group"
                  data-testid={`media-pick-${m.id}`}
                >
                  {m.kind === "video" ? (
                    <div className="relative">
                      <video
                        src={previewSrc}
                        className="w-full h-28 object-cover bg-black"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Film className="h-6 w-6 text-white/80 drop-shadow" />
                      </div>
                    </div>
                  ) : m.kind === "image" ? (
                    <img src={previewSrc} alt={m.name} className="w-full h-28 object-cover" />
                  ) : (
                    <div className="w-full h-28 bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      ملف
                    </div>
                  )}
                  <div className="p-2">
                    <div className="text-xs font-medium truncate group-hover:text-primary transition-colors" title={m.name}>
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
        <input
          ref={fileInput}
          type="file"
          hidden
          accept={acceptAttr}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <div
          className={`
            flex flex-col items-center justify-center gap-4 py-14 border-2 border-dashed rounded-xl transition-colors cursor-pointer
            ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}
          `}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}
          data-testid="media-upload-button"
        >
          <CloudUpload className={`h-10 w-10 transition-colors ${dragging ? "text-primary" : "text-muted-foreground/50"}`} />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {uploading
                ? "جاري الرفع..."
                : kind === "video"
                ? "اسحب الفيديو هنا أو انقر للاختيار"
                : "اسحب الصورة هنا أو انقر للاختيار"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {kind === "video"
                ? "MP4, WebM — حتى ٢٠ ميجابايت"
                : "JPG, PNG, WebP"}
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
