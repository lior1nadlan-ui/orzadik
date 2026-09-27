// One photo → a public URL in the product-images bucket: resize and re-encode
// in the browser (image-prepare.ts), then post to the admin upload server
// function. Shared by the product dialog's gallery and the quick-add dialog.

import { useServerFn } from "@tanstack/react-start";
import { uploadProductImage } from "@/lib/admin-products.functions";
import { blobToBase64, prepareImage } from "@/lib/image-prepare";

/** Server-side cap on one upload (admin-products.functions.ts). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function usePhotoUpload() {
  const upload = useServerFn(uploadProductImage);
  return async (file: File): Promise<string> => {
    const img = await prepareImage(file);
    if (img.blob.size > MAX_UPLOAD_BYTES) {
      throw new Error(`"${file.name}" גדולה מדי גם אחרי הקטנה.`);
    }
    const dataBase64 = await blobToBase64(img.blob);
    const res: { url: string } = await upload({
      data: { fileName: file.name, contentType: img.type, dataBase64 },
    });
    return res.url;
  };
}
