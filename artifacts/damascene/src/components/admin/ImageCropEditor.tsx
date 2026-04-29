import { useCallback, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { RotateCw, Check, X } from "lucide-react";

interface ImageCropEditorProps {
  file: File;
  onConfirm: (blob: Blob, name: string) => void;
  onCancel: () => void;
}

function rotateSrc(img: HTMLImageElement, mimeType: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalHeight;
  canvas.height = img.naturalWidth;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return canvas.toDataURL(mimeType || "image/jpeg", 0.92);
}

async function cropToBlob(
  img: HTMLImageElement,
  pixelCrop: PixelCrop,
  mimeType: string
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      mimeType || "image/jpeg",
      0.92
    );
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export default function ImageCropEditor({
  file,
  onConfirm,
  onCancel,
}: ImageCropEditorProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const mimeType = file.type || "image/jpeg";

  const [imageSrc, setImageSrc] = useState<string>(
    () => URL.createObjectURL(file)
  );
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [busy, setBusy] = useState(false);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
      const initial = centerCrop(
        makeAspectCrop({ unit: "%", width: 90 }, w / h, w, h),
        w,
        h
      );
      setCrop(initial);
    },
    []
  );

  const rotate = () => {
    if (!imgRef.current) return;
    const newSrc = rotateSrc(imgRef.current, mimeType);
    setImageSrc(newSrc);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const handleConfirm = async () => {
    if (!imgRef.current) return;
    setBusy(true);
    try {
      let blob: Blob;
      if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
        blob = await cropToBlob(imgRef.current, completedCrop, mimeType);
      } else if (imageSrc.startsWith("data:")) {
        blob = await dataUrlToBlob(imageSrc);
      } else {
        blob = file;
      }
      onConfirm(blob, file.name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <p className="text-sm text-muted-foreground text-center">
        اضبط منطقة الاقتصاص ثم اضغط «تأكيد»
      </p>

      <div className="overflow-auto rounded-md border bg-muted/20 max-h-[52vh] flex items-center justify-center w-full">
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          minWidth={20}
          minHeight={20}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="معاينة"
            style={{ maxHeight: "52vh", maxWidth: "100%", display: "block" }}
            onLoad={onImageLoad}
          />
        </ReactCrop>
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        <Button type="button" variant="outline" size="sm" onClick={rotate} title="تدوير 90°">
          <RotateCw className="h-4 w-4 ml-1.5" />
          تدوير
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          <X className="h-4 w-4 ml-1.5" />
          إلغاء
        </Button>
        <Button type="button" size="sm" onClick={handleConfirm} disabled={busy}>
          <Check className="h-4 w-4 ml-1.5" />
          {busy ? "جاري المعالجة..." : "تأكيد"}
        </Button>
      </div>
    </div>
  );
}
