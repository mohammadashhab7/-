import { useState } from "react";
import {
  useListContentBlocks, useUpsertContentBlock,
  useListMedia, useDeleteMedia, useGetMediaUploadUrl, useCreateMedia,
  getListContentBlocksQueryKey, getListMediaQueryKey,
} from "@workspace/api-client-react";
import type { ContentBlock } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { imgSrc } from "@/lib/imgSrc";
import { formatDateTime } from "@/lib/format";

function ContentTab() {
  const [page, setPage] = useState("home");
  const { data: blocks } = useListContentBlocks({ page });
  const upsert = useUpsertContentBlock();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ key: "", page, titleAr: "", contentAr: "", imageUrl: "", ctaLabel: "", ctaHref: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    upsert.mutate({ key: form.key, data: { ...form } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListContentBlocksQueryKey() });
        setOpen(false); toast({ title: "تم الحفظ" });
      },
      onError: () => toast({ title: "خطأ", variant: "destructive" }),
    });
  };

  const openEdit = (b: ContentBlock) => {
    setForm({
      key: b.key,
      page: b.page,
      titleAr: b.titleAr ?? "",
      contentAr: b.contentAr ?? "",
      imageUrl: b.imageUrl ?? "",
      ctaLabel: b.ctaLabel ?? "",
      ctaHref: b.ctaHref ?? "",
    });
    setOpen(true);
  };
  const openNew = () => {
    setForm({ key: "", page, titleAr: "", contentAr: "", imageUrl: "", ctaLabel: "", ctaHref: "" });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>كتل المحتوى</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={page} onValueChange={setPage}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="home">الرئيسية</SelectItem>
                <SelectItem value="story">قصتنا</SelectItem>
                <SelectItem value="contact">اتصل بنا</SelectItem>
                <SelectItem value="footer">التذييل</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openNew}><Plus className="ml-2 h-4 w-4" />كتلة جديدة</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>المفتاح</TableHead><TableHead>العنوان</TableHead><TableHead>المحتوى</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {blocks?.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-sm">{b.key}</TableCell>
                <TableCell className="font-medium">{b.titleAr || "-"}</TableCell>
                <TableCell className="text-sm text-foreground/70 max-w-md truncate">{b.contentAr}</TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => openEdit(b)}>تعديل</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>كتلة محتوى</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>المفتاح</Label><Input required value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} /></div>
            <div><Label>الصفحة</Label>
              <Select value={form.page} onValueChange={(v) => setForm({ ...form, page: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">الرئيسية</SelectItem>
                  <SelectItem value="story">قصتنا</SelectItem>
                  <SelectItem value="contact">اتصل بنا</SelectItem>
                  <SelectItem value="footer">التذييل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>العنوان</Label><Input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} /></div>
            <div><Label>المحتوى</Label><Textarea required rows={6} value={form.contentAr} onChange={(e) => setForm({ ...form, contentAr: e.target.value })} /></div>
            <div><Label>رابط الصورة</Label><Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>نص الزر</Label><Input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} /></div>
              <div><Label>رابط الزر</Label><Input value={form.ctaHref} onChange={(e) => setForm({ ...form, ctaHref: e.target.value })} /></div>
            </div>
            <DialogFooter><Button type="submit">حفظ</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MediaTab() {
  const { data: media } = useListMedia();
  const getUrl = useGetMediaUploadUrl();
  const create = useCreateMedia();
  const del = useDeleteMedia();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { uploadURL } = await getUrl.mutateAsync();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await create.mutateAsync({ data: { name: name || file.name, uploadURL, kind: file.type.startsWith("image/") ? "image" : "document" } });
      qc.invalidateQueries({ queryKey: getListMediaQueryKey() });
      toast({ title: "تم رفع الملف" });
      setName("");
    } catch (e: unknown) {
      const description = e instanceof Error ? e.message : undefined;
      toast({ title: "تعذّر الرفع", description, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const remove = (id: string) => {
    if (!confirm("حذف؟")) return;
    del.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListMediaQueryKey() }); } });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>الوسائط</CardTitle>
          <div className="flex items-center gap-2">
            <Input placeholder="اسم الملف (اختياري)" value={name} onChange={(e) => setName(e.target.value)} className="w-48" />
            <label className="cursor-pointer">
              <input type="file" hidden onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              <Button type="button" disabled={uploading} asChild><span><Upload className="ml-2 h-4 w-4" />{uploading ? "جاري الرفع..." : "رفع ملف"}</span></Button>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {media?.map((m) => (
            <div key={m.id} className="border rounded-lg overflow-hidden group relative">
              {m.kind === "image" ? (
                <img src={imgSrc(m.url)} alt={m.name} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-muted flex items-center justify-center text-sm text-muted-foreground">ملف</div>
              )}
              <div className="p-2">
                <div className="text-xs font-medium truncate">{m.name}</div>
                <div className="text-xs text-foreground/50">{formatDateTime(m.createdAt)}</div>
                <div className="text-xs text-foreground/40 truncate ltr-numbers">{m.url}</div>
              </div>
              <button onClick={() => remove(m.id)} className="absolute top-1 left-1 bg-destructive text-destructive-foreground rounded p-1 opacity-0 group-hover:opacity-100">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminCmsPage() {
  return (
    <Tabs defaultValue="content">
      <TabsList>
        <TabsTrigger value="content">المحتوى</TabsTrigger>
        <TabsTrigger value="media">الوسائط</TabsTrigger>
      </TabsList>
      <TabsContent value="content"><ContentTab /></TabsContent>
      <TabsContent value="media"><MediaTab /></TabsContent>
    </Tabs>
  );
}
