import { useCallback, useRef, useState } from "react";
import {
  useListMedia,
  useDeleteMedia,
  useCreateMedia,
  useGetMediaUploadUrl,
  useUpdateMedia,
  getListMediaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Pencil, Play, CloudUpload, Film, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { imgSrc } from "@/lib/imgSrc";
import ImageCropEditor from "@/components/admin/ImageCropEditor";

export default function AdminMediaPage() {
  const { data, isLoading, refetch } = useListMedia();
  const del = useDeleteMedia();
  const getUrl = useGetMediaUploadUrl();
  const create = useCreateMedia();
  const update = useUpdateMedia();
  const qc = useQueryClient();
  const { toast } = useToast();

  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: getListMediaQueryKey() });
  }, [qc]);

  const doUpload = useCallback(
    async (blob: Blob, name: string) => {
      setUploading(true);
      setCropFile(null);
      try {
        const upl = await getUrl.mutateAsync();
        const uploadURL = (upl as { uploadURL?: string }).uploadURL;
        if (!uploadURL) throw new Error("missing upload url");
        await fetch(uploadURL, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": blob.type || "image/jpeg" },
        });
        const detectedKind: "image" | "video" | "document" = blob.type.startsWith("image/")
          ? "image"
          : blob.type.startsWith("video/")
          ? "video"
          : "document";
        await create.mutateAsync({
          data: { name, uploadURL, kind: detectedKind },
        });
        refresh();
        await refetch();
        toast({ title: "تم الرفع" });
      } catch {
        toast({ title: "تعذّر الرفع", variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [getUrl, create, refresh, refetch, toast]
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

  const remove = (id: string, name: string) => {
    if (!confirm(`حذف "${name}"؟`)) return;
    del.mutate({ id }, {
      onSuccess: () => { refresh(); toast({ title: "تم الحذف" }); },
    });
  };

  const openRename = (id: string, currentName: string) => {
    setRenameId(id);
    setRenameName(currentName);
  };

  const submitRename = () => {
    if (!renameId || !renameName.trim()) return;
    update.mutate(
      { id: renameId, data: { name: renameName.trim() } },
      {
        onSuccess: () => {
          refresh();
          toast({ title: "تم تغيير الاسم" });
          setRenameId(null);
        },
        onError: () => toast({ title: "خطأ", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>رفع وسائط</CardTitle></CardHeader>
        <CardContent>
          {cropFile ? (
            <ImageCropEditor
              file={cropFile}
              onConfirm={(blob, name) => doUpload(blob, name)}
              onCancel={() => setCropFile(null)}
            />
          ) : (
            <>
              <input
                ref={fileInput}
                type="file"
                hidden
                accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv"
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
              >
                <CloudUpload className={`h-12 w-12 transition-colors ${dragging ? "text-primary" : "text-muted-foreground/40"}`} />
                <div className="text-center">
                  <p className="text-base font-medium">
                    {uploading ? "جاري الرفع..." : "اسحب ملفًا هنا أو انقر للاختيار"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    صور: JPG, PNG, WebP — فيديو: MP4, WebM
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    الصور ستُعرض محرر الاقتصاص قبل الرفع
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>المكتبة</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          ) : !data || data.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد وسائط بعد.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {data.map((m) => {
                const src = imgSrc(m.url);
                return (
                  <div
                    key={m.id}
                    className="group relative border border-border rounded-xl overflow-hidden bg-card hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    {m.kind === "video" ? (
                      <div className="relative">
                        <video
                          src={src}
                          className="w-full h-32 object-cover bg-black"
                          muted
                          playsInline
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-8 w-8 text-white drop-shadow fill-white" />
                        </div>
                      </div>
                    ) : m.kind === "image" ? (
                      <img src={src} alt={m.name} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
                        <FileText className="h-8 w-8 opacity-40" />
                        <span className="text-xs">مستند</span>
                      </div>
                    )}

                    <div className="p-2 text-xs">
                      <div className="truncate font-medium" title={m.name}>{m.name || "—"}</div>
                      {m.sizeBytes ? (
                        <div className="text-muted-foreground mt-0.5" dir="ltr">
                          {m.sizeBytes < 1024 * 1024
                            ? `${Math.round(m.sizeBytes / 1024)} KB`
                            : `${(m.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
                        </div>
                      ) : null}
                    </div>

                    <div className="absolute top-1.5 left-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="bg-white/90 text-foreground rounded-md p-1 hover:bg-white shadow-sm"
                        title="إعادة تسمية"
                        onClick={() => openRename(m.id, m.name)}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="bg-white/90 text-destructive rounded-md p-1 hover:bg-white shadow-sm"
                        title="حذف"
                        onClick={() => remove(m.id, m.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!renameId} onOpenChange={(v) => !v && setRenameId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إعادة تسمية</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>إلغاء</Button>
            <Button onClick={submitRename} disabled={update.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
