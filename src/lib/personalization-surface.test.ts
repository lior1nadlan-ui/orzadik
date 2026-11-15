import { describe, expect, it } from "vitest";
import {
  accentFromName,
  colorFromName,
  dominantColor,
  luminance,
  materialFromName,
  nameSize,
  surfaceFor,
  swatchStyle,
} from "@/lib/personalization-surface";

describe("materialFromName", () => {
  it("reads the material the catalogue names", () => {
    expect(materialFromName('תיק מפואר לטלית דמוי עור שחור 36X29 ס"מ')).toBe("leather");
    expect(materialFromName('סט טלית תפילין בד פשתן "האש שלי"')).toBe("linen");
    expect(materialFromName("תיק טלית ותפילין קטיפה כחול כהה")).toBe("velvet");
    expect(materialFromName("סט טלית ותפילין קורדרוי אפור")).toBe("corduroy");
    expect(materialFromName("מעמד לבנצ'ר מעץ זית")).toBe("wood");
    expect(materialFromName("תיק טלית PU שחור")).toBe("leather");
    // The catalogue's own spellings of PU, satin and denim.
    expect(materialFromName("סט טלית תפילין פיו מחורר צבע שחור")).toBe("leather");
    expect(materialFromName('כיסוי חלה סטן "קידוש שישי"')).toBe("satin");
    expect(materialFromName("כיסוי חלה לבן מסטן עם ריקמה")).toBe("satin");
    expect(materialFromName("מעמד סטנדר לסידור")).toBeNull(); // סטנד is not satin
    expect(materialFromName("מארז לחתן - דגם ג'ינס כחול")).toBe("denim");
  });

  it("takes the first material named, and plain fabric only when nothing more specific is", () => {
    expect(materialFromName("תיק קטיפה עם ידית דמוי עור")).toBe("velvet");
    expect(materialFromName("כיסוי חלה בד רקום")).toBe("fabric");
  });

  it("does not read a material out of another word", () => {
    expect(materialFromName("כיסוי חלה עם בדבש")).toBeNull(); // "בד" inside a word
    expect(materialFromName("מארז לחתן בסלסלה - לבן עם כתר")).toBeNull();
    expect(materialFromName(null)).toBeNull();
  });
});

describe("colorFromName", () => {
  it("takes the first colour word, with כהה / בהיר", () => {
    expect(colorFromName("תיק מפואר לטלית דמוי עור שחור")).toEqual({ r: 29, g: 29, b: 32 });
    const grey = colorFromName("סידור מעוצב צבע אפור")!;
    const dark = colorFromName("סידור מעוצב צבע אפור כהה")!;
    const light = colorFromName("סידור מעוצב צבע אפור בהיר")!;
    expect(luminance(dark)).toBeLessThan(luminance(grey));
    expect(luminance(light)).toBeGreaterThan(luminance(grey));
  });

  it("ignores the trim and a prefixed colour, which describe the thread", () => {
    // "רקמה בתכלת": the embroidery is light blue, not the set.
    expect(colorFromName("סט חלאקה פרימיום דגם פרי רקמה בתכלת")).toBeNull();
    // The first colour is the cover; the flowers come after.
    expect(colorFromName("כיסוי חלה מהודר דמוי עור לבן פרחים כחולים")).toEqual(
      colorFromName("לבן"),
    );
    expect(colorFromName('סידור "כתר התפילה" כריכה מהודרת דמוי עור')).toBeNull();
  });

  it("knows the catalogue's named shades", () => {
    expect(colorFromName("תיק טלית גוון בטון פיו מפואר")).not.toBeNull();
    expect(colorFromName("סידור מעוצב מזמור לתודה לגבר צבע ג'ינס כהה")).not.toBeNull();
  });
});

describe("accentFromName", () => {
  it("is gold unless the trim is silver only", () => {
    expect(accentFromName("ספר דברים - ורוד עם כסף")).toBe("silver");
    expect(accentFromName("סט טלית תפילין דמוי עור לבן עם הבלטה זהב")).toBe("gold");
    expect(accentFromName("תיק עם רקמה זהב וכסף")).toBe("gold");
    expect(accentFromName("תיק טלית")).toBe("gold");
  });
});

describe("surfaceFor", () => {
  it("keeps the old swatch for a product whose name says nothing", () => {
    const s = surfaceFor("מארז לחתן בסלסלה", "embroidery");
    expect(s.material).toBe("linen");
    expect(s.materialFrom).toBe("default");
    expect(s.colorFrom).toBe("default");
    expect(surfaceFor("מעמד בנצ'ר", "laser").material).toBe("wood");
    expect(surfaceFor("סידור מהודר", "print").material).toBe("leather");
  });

  it("prefers the name's colour to the photo's, and uses the photo when the name has none", () => {
    const photo = { r: 20, g: 40, b: 90 };
    expect(surfaceFor("תיק דמוי עור לבן", "embroidery", photo).colorFrom).toBe("name");
    const s = surfaceFor("סידור כריכה מהודרת דמוי עור", "print", photo);
    expect(s.colorFrom).toBe("photo");
    expect(s.color).toEqual(photo);
  });
});

describe("swatchStyle", () => {
  it("embroiders bright gold on a dark product and deep gold on a light one", () => {
    const onBlack = swatchStyle(surfaceFor("תיק קטיפה שחור", "embroidery"), "embroidery");
    const onWhite = swatchStyle(surfaceFor("תיק דמוי עור לבן", "embroidery"), "embroidery");
    expect(onBlack.text.color).not.toBe(onWhite.text.color);
    expect(onBlack.onMaterial).toBe("על קטיפה");
    expect(onWhite.onMaterial).toBe("על דמוי עור");
  });

  it("stamps in foil, laser-marks dark leather pale and wood dark", () => {
    const foil = swatchStyle(surfaceFor("סידור דמוי עור שחור", "print"), "print");
    expect(foil.text.WebkitBackgroundClip).toBe("text");
    const onDark = swatchStyle(surfaceFor("כיסוי לייזר דמוי עור שחור", "laser"), "laser");
    const onWood = swatchStyle(surfaceFor("מעמד מעץ", "laser"), "laser");
    expect(onDark.text.color).not.toBe(onWood.text.color);
    expect(onWood.text.color).toBe("rgb(67, 52, 30)");
  });

  it("names no material it only assumed", () => {
    expect(swatchStyle(surfaceFor("מארז לחתן", "embroidery"), "embroidery").onMaterial).toBeNull();
  });
});

describe("dominantColor", () => {
  const image = (w: number, h: number, fill: (x: number, y: number) => number[]) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) data.set(fill(x, y), (y * w + x) * 4);
    }
    return data;
  };

  it("finds the product's colour on a white studio background", () => {
    const navy = [30, 45, 90, 255];
    const data = image(20, 20, (x, y) =>
      x > 4 && x < 15 && y > 4 && y < 15 ? navy : [255, 255, 255, 255],
    );
    const c = dominantColor(data, 20, 20)!;
    expect(c).toEqual({ r: 30, g: 45, b: 90 });
  });

  it("calls a white product white", () => {
    const data = image(20, 20, (x, y) =>
      x === 10 && y === 10 ? [200, 160, 60, 255] : [246, 244, 240, 255],
    );
    expect(dominantColor(data, 20, 20)).toEqual({ r: 246, g: 244, b: 240 });
  });

  it("returns null for an empty or transparent frame", () => {
    expect(dominantColor(new Uint8ClampedArray(20 * 20 * 4), 20, 20)).toBeNull();
  });
});

describe("nameSize", () => {
  it("shrinks long dedications", () => {
    expect(nameSize("יוסף")).toBe("xl");
    expect(nameSize("משפחת לוי מירושלים")).toBe("lg");
    expect(nameSize("לחתן היקר יוסף לרגל יום חתונתו")).toBe("md");
    expect(nameSize("א".repeat(55))).toBe("sm");
  });
});
