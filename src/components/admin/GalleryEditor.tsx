// The product's photos as one ordered list: the first is the main image
// (products.thumbnail_url), the rest are the gallery (product_images), exactly
// the order the product page shows them in.
//
// Drop several photos at once or pick them from the phone — each is resized
// and converted before upload, so a camera photo over 5 MB goes through.

import { useRef, useState, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export function GalleryEditor({
  urls,
  onChange,
  uploadPhoto,
  onBusyChange,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
  /** Resize + upload one photo, resolving to its public URL. */
  uploadPhoto: (file: File) => Promise<string>;
  /** Lets the dialog hold its save button while photos are uploading. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const [pending, setPending] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Uploads finish out of order; append each to the latest list, not a stale one.
  const latest = useRef(urls);
  latest.current = urls;

  const addFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      toast.error("יש לבחור קבצי תמונה.");
      return;
    }
    setPending((n) => n + images.length);
    onBusyChange?.(true);
    let ok = 0;
    await Promise.all(
      images.map(async (file) => {
        try {
          const url = await uploadPhoto(file);
          latest.current = [...latest.current, url];
          onChange(latest.current);
          ok++;
        } catch (e: any) {
          toast.error(e?.message ?? `העלאת "${file.name}" נכשלה`);
        } finally {
          setPending((n) => {
            const left = n - 1;
            if (left === 0) onBusyChange?.(false);
            return left;
          });
        }
      }),
    );
    if (ok > 0) toast.success(ok === 1 ? "התמונה הועלתה" : `הועלו ${ok} תמונות`);
  };

  const move = (i: number, to: number) => {
    if (to < 0 || to >= urls.length) return;
    const next = [...urls];
    const [item] = next.splice(i, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">תמונות המוצר</span>
        <span className="text-[11px] text-muted-foreground">
          הראשונה היא התמונה הראשית · {urls.length} תמונות
        </span>
      </div>

      {urls.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {urls.map((u, i) => (
            <li
              key={u}
              className={`relative overflow-hidden rounded-md border ${
                i === 0 ? "ring-2 ring-primary" : ""
              }`}
            >
              <img src={u} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 start-1 inline-flex items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  <Star className="h-2.5 w-2.5" /> ראשית
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange(urls.filter((_, j) => j !== i))}
                aria-label="הסר תמונה"
                className="absolute top-1 end-1 grid h-6 w-6 place-content-center rounded-full border bg-card/90 shadow-sm hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-card/85 px-1 py-0.5">
                {/* RTL: "earlier" is to the right. */}
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label="הזז קדימה"
                  className="grid h-6 w-6 place-content-center rounded hover:bg-muted disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => move(i, 0)}
                    className="rounded px-1 text-[10px] font-medium hover:bg-muted"
                  >
                    הפוך לראשית
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === urls.length - 1}
                  aria-label="הזז אחורה"
                  className="grid h-6 w-6 place-content-center rounded hover:bg-muted disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-3 py-5 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "hover:bg-muted/50"
        } ${pending > 0 ? "pointer-events-none opacity-60" : ""}`}
      >
        <ImagePlus className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm font-medium">
          {pending > 0 ? `מעלה ${pending} תמונות…` : "גררו תמונות לכאן או לחצו לבחירה"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          אפשר כמה תמונות יחד, גם ישר מהטלפון. התמונות מוקטנות אוטומטית.
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void addFiles(files);
        }}
      />

      <div className="flex gap-2">
        <Input
          dir="ltr"
          placeholder="או הדביקו כתובת תמונה (https://…)"
          value={pasteUrl}
          onChange={(e) => setPasteUrl(e.target.value)}
          className="h-9 text-xs"
        />
        <button
          type="button"
          disabled={!/^https?:\/\/\S+$/.test(pasteUrl.trim())}
          onClick={() => {
            const u = pasteUrl.trim();
            if (!urls.includes(u)) onChange([...urls, u]);
            setPasteUrl("");
          }}
          className="shrink-0 rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:opacity-40"
        >
          הוסף
        </button>
      </div>
    </div>
  );
}
