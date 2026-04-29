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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { imgSrc } from "@/lib/imgSrc";
import { formatDateTime } from "@/lib/format";
import MediaPicker from "@/components/admin/MediaPicker";

type Meta = Record<string, unknown>;

function metaString(m: Meta, k: string): string {
  const v = m[k];
  return typeof v === "string" ? v : "";
}

function metaNumber(m: Meta, k: string, fallback: number): number {
  const v = m[k];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function metaSlides(m: Meta): Array<{ imageUrl: string; alt?: string }> {
  const v = m["slides"];
  if (!Array.isArray(v)) return [];
  return v.filter(
    (s): s is { imageUrl: string; alt?: string } =>
      typeof s === "object" && s !== null && typeof (s as { imageUrl?: unknown }).imageUrl === "string"
  );
}

interface BlockForm {
  key: string;
  page: string;
  titleAr: string;
  contentAr: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  metadata: Meta;
}

function emptyForm(page: string): BlockForm {
  return {
    key: "",
    page,
    titleAr: "",
    contentAr: "",
    imageUrl: "",
    ctaLabel: "",
    ctaHref: "",
    metadata: {},
  };
}

function fromBlock(b: ContentBlock): BlockForm {
  const meta = (b.metadata ?? {}) as Meta;
  return {
    key: b.key,
    page: b.page,
    titleAr: b.titleAr ?? "",
    contentAr: b.contentAr ?? "",
    imageUrl: b.imageUrl ?? "",
    ctaLabel: b.ctaLabel ?? "",
    ctaHref: b.ctaHref ?? "",
    metadata: { ...meta },
  };
}

function ContentTab() {
  const [page, setPage] = useState("home");
  const { data: blocks } = useListContentBlocks({ page });
  const upsert = useUpsertContentBlock();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BlockForm>(emptyForm("home"));

  const setMeta = (patch: Meta) =>
    setForm((f) => ({ ...f, metadata: { ...f.metadata, ...patch } }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    upsert.mutate(
      {
        key: form.key,
        data: {
          page: form.page,
          titleAr: form.titleAr || undefined,
          contentAr: form.contentAr,
          imageUrl: form.imageUrl || undefined,
          ctaLabel: form.ctaLabel || undefined,
          ctaHref: form.ctaHref || undefined,
          metadata: form.metadata,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListContentBlocksQueryKey() });
          setOpen(false);
          toast({ title: "تم الحفظ" });
        },
        onError: () => toast({ title: "خطأ", variant: "destructive" }),
      },
    );
  };

  const openEdit = (b: ContentBlock) => {
    setForm(fromBlock(b));
    setOpen(true);
  };

  const openNew = () => {
    setForm(emptyForm(page));
    setOpen(true);
  };

  const isHero = form.key === "home_hero" || form.key.endsWith("_hero");
  const isStorySection = form.key === "home_story_excerpt";
  // Most home content blocks are visual sections that benefit from main media controls.
  const showMainMedia =
    form.key === "home_categories_section" ||
    form.key === "home_featured_section" ||
    form.key === "home_quality_strip" ||
    form.key === "home_cta" ||
    isStorySection ||
    form.page === "story" ||
    form.page === "contact";

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
            <Button onClick={openNew} data-testid="button-new-block"><Plus className="ml-2 h-4 w-4" />كتلة جديدة</Button>
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
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(b)} data-testid={`button-edit-${b.key}`}>
                    تعديل
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>تعديل كتلة محتوى</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4" data-testid="form-content-block">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>المفتاح</Label>
                <Input
                  required
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  placeholder="home_hero"
                  className="ltr-numbers"
                  dir="ltr"
                  data-testid="input-key"
                />
              </div>
              <div>
                <Label>الصفحة</Label>
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
            </div>

            <div>
              <Label>العنوان</Label>
              <Input
                value={form.titleAr}
                onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                data-testid="input-title"
              />
            </div>

            <div>
              <Label>المحتوى</Label>
              <Textarea
                required
                rows={5}
                value={form.contentAr}
                onChange={(e) => setForm({ ...form, contentAr: e.target.value })}
                data-testid="input-content"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>نص الزر الأساسي</Label>
                <Input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} data-testid="input-cta-label" />
              </div>
              <div>
                <Label>رابط الزر الأساسي</Label>
                <Input value={form.ctaHref} onChange={(e) => setForm({ ...form, ctaHref: e.target.value })} className="ltr-numbers" dir="ltr" data-testid="input-cta-href" />
              </div>
            </div>

            {/* Hero-specific media controls */}
            {isHero && (() => {
              const heroType = metaString(form.metadata, "mediaType") || "image";
              const slides = metaSlides(form.metadata);
              const updateSlide = (idx: number, imageUrl: string) => {
                const next = [...slides];
                next[idx] = { ...next[idx], imageUrl };
                setMeta({ slides: next });
              };
              const addSlide = () => setMeta({ slides: [...slides, { imageUrl: "" }] });
              const removeSlide = (idx: number) =>
                setMeta({ slides: slides.filter((_, i) => i !== idx) });
              const intervalSec = metaNumber(form.metadata, "sliderInterval", 5000) / 1000;
              const transitionMs = metaNumber(form.metadata, "sliderTransition", 800);
              const showDots = form.metadata["sliderShowDots"] !== false;
              return (
                <fieldset className="border rounded-md p-4 space-y-4">
                  <legend className="px-2 text-sm font-semibold text-primary">وسائط القسم الرئيسي (الـHero)</legend>

                  <div>
                    <Label>نوع الخلفية</Label>
                    <Select
                      value={heroType}
                      onValueChange={(v) => setMeta({ mediaType: v })}
                    >
                      <SelectTrigger data-testid="select-hero-media-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">صورة</SelectItem>
                        <SelectItem value="slider">سلايدر</SelectItem>
                        <SelectItem value="video">فيديو</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {heroType === "slider"
                        ? "سيتم التنقل تلقائيًا بين الصور بتأثير انسيابي."
                        : heroType === "video"
                        ? "يُشغَّل الفيديو تلقائيًا بدون صوت وفي حلقة مستمرة."
                        : "تظهر صورة ثابتة واحدة كخلفية للقسم."}
                    </p>
                  </div>

                  {/* Single image mode */}
                  {heroType === "image" && (
                    <MediaPicker
                      label="صورة الخلفية"
                      value={form.imageUrl}
                      onChange={(url) => setForm({ ...form, imageUrl: url })}
                      kind="image"
                      helperText="الصورة الثابتة المعروضة كخلفية للقسم الرئيسي."
                      testId="picker-hero-image"
                    />
                  )}

                  {/* Video mode */}
                  {heroType === "video" && (
                    <>
                      <MediaPicker
                        label="فيديو الخلفية"
                        value={metaString(form.metadata, "videoUrl")}
                        onChange={(url) => setMeta({ videoUrl: url })}
                        kind="video"
                        helperText="تشغيل تلقائي بدون صوت وفي حلقة مستمرة."
                        testId="picker-hero-video"
                      />
                      <MediaPicker
                        label="صورة احتياطية للفيديو"
                        value={metaString(form.metadata, "fallbackImageUrl")}
                        onChange={(url) => setMeta({ fallbackImageUrl: url })}
                        kind="image"
                        helperText="تظهر إذا تعذّر تحميل الفيديو أو على الأجهزة التي لا تدعمه."
                        testId="picker-hero-fallback"
                      />
                    </>
                  )}

                  {/* Slider mode */}
                  {heroType === "slider" && (
                    <div className="space-y-3">
                      <Label>شرائح السلايدر</Label>
                      {slides.length === 0 && (
                        <p className="text-sm text-muted-foreground">لا توجد شرائح. أضف شريحة للبدء.</p>
                      )}
                      {slides.map((slide, idx) => (
                        <div key={idx} className="flex items-end gap-2" data-testid={`slider-slide-${idx}`}>
                          <div className="flex-1">
                            <MediaPicker
                              label={`شريحة ${idx + 1}`}
                              value={slide.imageUrl}
                              onChange={(url) => updateSlide(idx, url)}
                              kind="image"
                              testId={`picker-slide-${idx}`}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSlide(idx)}
                            className="text-destructive hover:text-destructive mb-1"
                            data-testid={`button-remove-slide-${idx}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addSlide}
                        data-testid="button-add-slide"
                      >
                        <Plus className="ml-1.5 h-4 w-4" />
                        إضافة شريحة
                      </Button>

                      <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                        <div>
                          <Label>مدة عرض الشريحة (ثوانٍ)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            step={0.5}
                            value={intervalSec}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v >= 1)
                                setMeta({ sliderInterval: Math.round(v * 1000) });
                            }}
                            className="ltr-numbers mt-1"
                            dir="ltr"
                            data-testid="input-slider-interval"
                          />
                        </div>
                        <div>
                          <Label>مدة الانتقال (ملي ثانية)</Label>
                          <Input
                            type="number"
                            min={100}
                            max={3000}
                            step={100}
                            value={transitionMs}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v >= 100)
                                setMeta({ sliderTransition: v });
                            }}
                            className="ltr-numbers mt-1"
                            dir="ltr"
                            data-testid="input-slider-transition"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="slider-show-dots"
                          checked={showDots}
                          onChange={(e) => setMeta({ sliderShowDots: e.target.checked })}
                          className="accent-primary h-4 w-4"
                          data-testid="checkbox-slider-dots"
                        />
                        <label htmlFor="slider-show-dots" className="text-sm">
                          عرض نقاط التنقل
                        </label>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <Label>درجة تعتيم الطبقة الداكنة</Label>
                      <span className="text-sm font-mono text-muted-foreground ltr-numbers">
                        {metaNumber(form.metadata, "overlayOpacity", 60)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={metaNumber(form.metadata, "overlayOpacity", 60)}
                      onChange={(e) => setMeta({ overlayOpacity: Number(e.target.value) })}
                      className="w-full mt-2 accent-primary"
                      data-testid="input-hero-overlay"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      تحكّم بشفافية الطبقة الداكنة فوق الخلفية لضمان وضوح النصوص. القيمة الافتراضية ٦٠٪.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div>
                      <Label>نص الزر الثانوي</Label>
                      <Input
                        value={metaString(form.metadata, "ctaSecondary")}
                        onChange={(e) => setMeta({ ctaSecondary: e.target.value })}
                        data-testid="input-cta-secondary-label"
                      />
                    </div>
                    <div>
                      <Label>رابط الزر الثانوي</Label>
                      <Input
                        value={metaString(form.metadata, "ctaSecondaryHref")}
                        onChange={(e) => setMeta({ ctaSecondaryHref: e.target.value })}
                        className="ltr-numbers"
                        dir="ltr"
                        data-testid="input-cta-secondary-href"
                      />
                    </div>
                  </div>
                </fieldset>
              );
            })()}

            {/* Story / generic section media controls */}
            {!isHero && showMainMedia && (
              <fieldset className="border rounded-md p-4 space-y-4">
                <legend className="px-2 text-sm font-semibold text-primary">وسائط القسم</legend>

                <MediaPicker
                  label="الصورة الأساسية"
                  value={form.imageUrl}
                  onChange={(url) => setForm({ ...form, imageUrl: url })}
                  kind="image"
                  testId="picker-section-image"
                />

                <MediaPicker
                  label="فيديو اختياري"
                  value={metaString(form.metadata, "videoUrl")}
                  onChange={(url) => setMeta({ videoUrl: url })}
                  kind="video"
                  helperText="إذا تم اختياره سيُعرض الفيديو بدلًا من الصورة على الشاشات الكبيرة."
                  testId="picker-section-video"
                />

                <div className="border-t pt-3 space-y-4">
                  <p className="text-xs font-medium text-muted-foreground">النسخة المخصّصة للهاتف (اختياري)</p>
                  <MediaPicker
                    label="صورة الهاتف"
                    value={metaString(form.metadata, "mobileImageUrl")}
                    onChange={(url) => setMeta({ mobileImageUrl: url })}
                    kind="image"
                    helperText="إن لم تُحدَّد، تُستخدم الصورة الأساسية على جميع الأحجام."
                    testId="picker-section-mobile-image"
                  />
                  <MediaPicker
                    label="فيديو الهاتف"
                    value={metaString(form.metadata, "mobileVideoUrl")}
                    onChange={(url) => setMeta({ mobileVideoUrl: url })}
                    kind="video"
                    testId="picker-section-mobile-video"
                  />
                </div>

                <div>
                  <Label>النص البديل (Alt)</Label>
                  <Input
                    value={metaString(form.metadata, "alt")}
                    onChange={(e) => setMeta({ alt: e.target.value })}
                    placeholder="وصف مختصر للصورة لقارئات الشاشة ومحركات البحث"
                    data-testid="input-section-alt"
                  />
                </div>
              </fieldset>
            )}

            {/* Generic image-only fallback for blocks without a specific section UI */}
            {!isHero && !showMainMedia && (
              <MediaPicker
                label="رابط الصورة"
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url })}
                kind="image"
                testId="picker-generic-image"
              />
            )}

            <DialogFooter>
              <Button type="submit" data-testid="button-save-block">حفظ</Button>
            </DialogFooter>
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
      const detectedKind = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
        ? "video"
        : "document";
      await create.mutateAsync({ data: { name: name || file.name, uploadURL, kind: detectedKind } });
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
              ) : m.kind === "video" ? (
                <video src={imgSrc(m.url)} className="w-full h-32 object-cover bg-black" muted playsInline />
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
