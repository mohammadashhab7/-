import { useState } from "react";
import {
  useListMedia,
  useDeleteMedia,
  useCreateMedia,
  useGetMediaUploadUrl,
  getListMediaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { imgSrc } from "@/lib/imgSrc";

export default function AdminMediaPage() {
  const { data, isLoading } = useListMedia();
  const del = useDeleteMedia();
  const getUrl = useGetMediaUploadUrl();
  const create = useCreateMedia();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: getListMediaQueryKey() });

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const upl = await getUrl.mutateAsync();
      const uploadURL = (upl as { uploadURL?: string }).uploadURL;
      if (!uploadURL) throw new Error("missing upload url");
      const put = await fetch(uploadURL, { method: "PUT", body: file });
      if (!put.ok) throw new Error("upload failed");
      const kind: "image" | "document" = file.type.startsWith("image/") ? "image" : "document";
      await create.mutateAsync({
        data: { name: name || file.name, uploadURL, kind },
      });
      setFile(null);
      setName("");
      refresh();
      toast({ title: "تم الرفع" });
    } catch {
      toast({ title: "تعذّر الرفع", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => {
    if (!confirm("حذف هذا العنصر؟")) return;
    del.mutate({ id }, {
      onSuccess: () => { refresh(); toast({ title: "تم الحذف" }); },
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>رفع وسائط</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={upload} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
            <div>
              <Label>الملف</Label>
              <Input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <Label>الاسم (اختياري)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={file?.name ?? ""} />
            </div>
            <Button type="submit" disabled={!file || busy}>
              <Upload className="ml-2 h-4 w-4" />
              {busy ? "جارٍ الرفع..." : "رفع"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>المكتبة</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p>جاري التحميل...</p>
          ) : !data || data.length === 0 ? (
            <p className="text-foreground/60">لا توجد وسائط بعد.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {data.map((m) => (
                <div key={m.id} className="border border-border rounded-md overflow-hidden bg-card">
                  {m.kind === "image" ? (
                    <img src={imgSrc(m.url)} alt={m.name} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-muted text-foreground/60 text-xs">مستند</div>
                  )}
                  <div className="p-2 text-xs">
                    <div className="truncate" title={m.name}>{m.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-foreground/50" dir="ltr">
                        {m.sizeBytes ? `${Math.round(m.sizeBytes / 1024)} KB` : ""}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
