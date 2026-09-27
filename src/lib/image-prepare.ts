// Browser-only: turn a picked or dropped photo into a web-ready upload.
//
// A phone photo is typically 3-8 MB at 4032x3024 — over the 5 MB upload cap,
// and ten times what a product page needs. Here it is decoded (EXIF rotation
// applied by createImageBitmap), scaled to MAX_PHOTO_SIDE on the long side and
// re-encoded as WebP, falling back to JPEG where the browser cannot encode
// WebP. A typical result is 150-400 KB. GIFs are passed through untouched so an
// animation is not flattened.
//
// Call only from event handlers (never during SSR).

import { fitWithin, MAX_PHOTO_SIDE } from "@/lib/admin-catalog";

export type PreparedImage = { blob: Blob; type: string; width: number; height: number };

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new Error("יש לבחור קובץ תמונה.");
  if (file.type === "image/gif") return { blob: file, type: file.type, width: 0, height: 0 };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`לא ניתן לקרוא את "${file.name}" — נסו לשמור אותה כ-JPG או PNG.`);
  }
  const sourceWidth = bitmap.width;
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_PHOTO_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("הדפדפן לא הצליח לעבד את התמונה.");
  }
  // White under transparent PNGs, so a JPEG fallback does not turn them black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = await canvasToBlob(canvas, "image/webp", 0.85);
  if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", 0.88);
  if (!blob) throw new Error("הדפדפן לא הצליח לעבד את התמונה.");

  // An already-small web image can come out larger after re-encoding; keep the
  // original then, as long as it is a type the server accepts.
  const acceptedOriginal = /^image\/(png|jpe?g|webp|avif)$/.test(file.type);
  if (acceptedOriginal && file.size <= blob.size && width === sourceWidth) {
    return { blob: file, type: file.type, width, height };
  }
  return { blob, type: blob.type, width, height };
}

/** Raw base64 (no data: prefix) for the upload server function. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
