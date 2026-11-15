// What the personalization הדמיה is drawn on: the product's own material and
// colour, so a name embroidered on a black velvet bag is previewed on black
// velvet, a stamped siddur in gold foil on its leather cover, and a laser mark
// as a burn on wood or a pale mark on dark faux leather. Until 15.11.2026 every
// product got the same beige linen (or the same wood for laser), whatever it was.
//
// Of the 736 personalizable products, 362 are faux leather, 59 linen, 26
// velvet and 25 corduroy by their own names; 61% name a colour ("לבן" 146,
// "שחור" 101, "אפור" 54...). Products that share one name across colours (13
// siddur covers are all "כריכה מהודרת דמוי עור") get their colour from their
// photo instead: PersonalizationPreview samples it in the browser and hands
// the pixels to dominantColor() here.
//
// Pure (no DOM, no React), so it is unit-tested and renders the same on the
// server. Still a הדמיה: the font, shade and placement are coordinated with
// the buyer after the order, as the product page and the guide say.

export type Technique = "embroidery" | "print" | "laser";

export type SurfaceMaterial =
  | "leather"
  | "linen"
  | "velvet"
  | "corduroy"
  | "suede"
  | "tweed"
  | "denim"
  | "satin"
  | "fabric"
  | "wood"
  | "acrylic"
  | "metal";

export type Rgb = { r: number; g: number; b: number };

export type Surface = {
  material: SurfaceMaterial;
  /** Whether the material came from the product's name or is the technique's default. */
  materialFrom: "name" | "default";
  color: Rgb;
  colorFrom: "name" | "photo" | "default";
  /** Gold or silver: the product's own trim ("עם הבלטה זהב", "ורוד עם כסף"). */
  accent: "gold" | "silver";
};

const HEB = "א-ת";

// Each material by the words the catalogue uses for it. The FIRST material
// named wins: "תיק קטיפה עם ידית דמוי עור" is velvet. The generic "בד" is a
// fallback only: "בד פשתן" is linen.
const MATERIAL_PATTERNS: Array<[RegExp, SurfaceMaterial]> = [
  [/קטיפה/, "velvet"],
  [/קורדרוי/, "corduroy"],
  [/סוויד|זמש/, "suede"],
  [/טוויד|מלאנז/, "tweed"],
  [new RegExp(`סאטן|(^|[^${HEB}])[מבו]?סטן(?![${HEB}])|משי(?![${HEB}])`), "satin"],
  [/ג['׳]?ינס/, "denim"],
  [/פשתן/, "linen"],
  // "פיו" and "פיויסי" are how the catalogue spells PU and PVC.
  [
    new RegExp(
      `דמוי[ -]?עור|(^|[^${HEB}])[מבו]?עור(?![${HEB}])|(^|[^${HEB}])פיו(יסי)?(?![${HEB}])|(^|[^a-z])(pu|pvc)(?![a-z])`,
      "i",
    ),
    "leather",
  ],
  [/אקריליק|פרספקס|זכוכית|קריסטל|לוסייט/, "acrylic"],
  [/ניקל|מתכת|אלומיניום|נירוסטה/, "metal"],
  [new RegExp(`(^|[^${HEB}])[מבו]?(עץ|במבוק)(?![${HEB}])`), "wood"],
  [new RegExp(`(^|[^${HEB}])(בד|ארוג|מרופד)(?![${HEB}])`), "fabric"],
];

const DEFAULT_MATERIAL: Record<Technique, SurfaceMaterial> = {
  embroidery: "linen",
  print: "leather",
  laser: "wood",
};

const hex = (h: string): Rgb => ({
  r: parseInt(h.slice(1, 3), 16),
  g: parseInt(h.slice(3, 5), 16),
  b: parseInt(h.slice(5, 7), 16),
});

// A neutral tone per material for when neither the name nor the photo says the
// colour: close to the material's usual look, without claiming a colour.
const NEUTRAL: Record<SurfaceMaterial, Rgb> = {
  leather: hex("#7a6e64"),
  linen: hex("#ece4d3"),
  velvet: hex("#5e5866"),
  corduroy: hex("#8a8076"),
  suede: hex("#9a8e82"),
  tweed: hex("#8e8983"),
  denim: hex("#3b5a85"),
  satin: hex("#dcd6cc"),
  fabric: hex("#e4dccb"),
  wood: hex("#cdb389"),
  acrylic: hex("#e6ecf0"),
  metal: hex("#b8bbbf"),
};

// The colour words in the catalogue's names, unprefixed: "רקמה בתכלת" is the
// thread, not the bag, so a word with ב in front of it never sets the base.
const COLOR_WORDS: Record<string, Rgb> = {
  שחור: hex("#1d1d20"),
  שחורה: hex("#1d1d20"),
  לבן: hex("#f2efe9"),
  לבנה: hex("#f2efe9"),
  אפור: hex("#86898e"),
  אפורה: hex("#86898e"),
  כחול: hex("#24427a"),
  כחולה: hex("#24427a"),
  נייבי: hex("#1c2742"),
  תכלת: hex("#9cc4e2"),
  טורקיז: hex("#2b9e9c"),
  בורדו: hex("#5c1b26"),
  אדום: hex("#9b1d24"),
  אדומה: hex("#9b1d24"),
  חום: hex("#5b3b2a"),
  חומה: hex("#5b3b2a"),
  קאמל: hex("#b07e50"),
  בז: hex("#d8c3a2"),
  שמנת: hex("#efe5cf"),
  קרם: hex("#efe5cf"),
  אופוויט: hex("#f1ebdd"),
  ורוד: hex("#e6b3c2"),
  ורודה: hex("#e6b3c2"),
  רוז: hex("#d9a3a9"),
  ירוק: hex("#2f5c3b"),
  ירוקה: hex("#2f5c3b"),
  סגול: hex("#5a3b78"),
  סגולה: hex("#5a3b78"),
  מוקה: hex("#6b4b3b"),
  ברונזה: hex("#8b6a3e"),
  // "גוון בטון", "ג'ינס כחול": named shades rather than colour words.
  בטון: hex("#8f8c87"),
  גינס: hex("#3b5a85"),
};

const GOLD_WORDS = new Set(["זהב", "בזהב", "וזהב", "גולד", "זהוב", "זהובה", "מוזהב", "מוזהבת"]);
const SILVER_WORDS = new Set([
  "כסף",
  "בכסף",
  "וכסף",
  "כסוף",
  "כסופה",
  "בכסוף",
  "סילבר",
  "מוכסף",
  "מוכספת",
]);

const tokens = (name: string) =>
  name
    .toLowerCase()
    .replace(/["'׳״`]/g, "")
    .split(/[^a-zא-ת]+/)
    .filter(Boolean);

/** The material the product's name says, or null. */
export function materialFromName(name: string | null | undefined): SurfaceMaterial | null {
  const n = (name ?? "").toLowerCase();
  let best: { at: number; material: SurfaceMaterial } | null = null;
  for (const [re, material] of MATERIAL_PATTERNS) {
    if (material === "fabric") continue;
    const m = re.exec(n);
    if (m && (best === null || m.index < best.at)) best = { at: m.index, material };
  }
  if (best) return best.material;
  return MATERIAL_PATTERNS.some(([re, material]) => material === "fabric" && re.test(n))
    ? "fabric"
    : null;
}

/** The product's colour as its name says it, with "כהה" / "בהיר" applied; null if none. */
export function colorFromName(name: string | null | undefined): Rgb | null {
  const ts = tokens(name ?? "");
  for (let i = 0; i < ts.length; i++) {
    let base = COLOR_WORDS[ts[i]];
    if (!base) continue;
    if (ts[i] === "כחול" && ts[i + 1] === "רויאל") base = hex("#2b4ea2");
    const next = ts.slice(i + 1, i + 3);
    if (next.includes("כהה")) return mix(base, { r: 0, g: 0, b: 0 }, 0.4);
    if (next.includes("בהיר") || next.includes("בהירה")) {
      return mix(base, { r: 255, g: 255, b: 255 }, 0.4);
    }
    return base;
  }
  return null;
}

/** Gold unless the name's trim is silver only. */
export function accentFromName(name: string | null | undefined): "gold" | "silver" {
  const ts = tokens(name ?? "");
  const gold = ts.some((t) => GOLD_WORDS.has(t));
  const silver = ts.some((t) => SILVER_WORDS.has(t));
  return silver && !gold ? "silver" : "gold";
}

/**
 * Everything the name says. `photoColor` (from dominantColor) fills in the
 * colour when the name has none; the name wins when it has one, because it is
 * the catalogue's own word and a photo can be lit or styled.
 */
export function surfaceFor(
  name: string | null | undefined,
  technique: Technique,
  photoColor: Rgb | null = null,
): Surface {
  const named = materialFromName(name);
  const material = named ?? DEFAULT_MATERIAL[technique];
  const fromName = colorFromName(name);
  // The default look (no material in the name) keeps the colour the swatch
  // always had for that technique, so a product the name says nothing about
  // looks exactly as before until its photo is read.
  const color = fromName ?? photoColor ?? NEUTRAL[material];
  return {
    material,
    materialFrom: named ? "name" : "default",
    color,
    colorFrom: fromName ? "name" : photoColor ? "photo" : "default",
    accent: accentFromName(name),
  };
}

// ---------------------------------------------------------------------------
// The photo's colour.

/**
 * The product's colour in an RGBA pixel buffer (a small canvas draw of its
 * photo): the commonest tone in the middle 60% of the frame, where the product
 * sits, ignoring the white studio background. A product that is mostly white
 * in the middle IS white (a white bag on a white background), and gets the
 * average of those pixels. Null when nothing usable is there.
 */
export function dominantColor(data: ArrayLike<number>, width: number, height: number): Rgb | null {
  const x0 = Math.floor(width * 0.2);
  const x1 = Math.ceil(width * 0.8);
  const y0 = Math.floor(height * 0.2);
  const y1 = Math.ceil(height * 0.8);
  let total = 0;
  let light = 0;
  const lightSum = { r: 0, g: 0, b: 0 };
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      if ((data[i + 3] ?? 0) < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      total += 1;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (min >= 228 && max - min <= 20) {
        light += 1;
        lightSum.r += r;
        lightSum.g += g;
        lightSum.b += b;
        continue;
      }
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
      const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bin.n += 1;
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bins.set(key, bin);
    }
  }
  if (total === 0) return null;
  if (light / total > 0.6) {
    return {
      r: Math.round(lightSum.r / light),
      g: Math.round(lightSum.g / light),
      b: Math.round(lightSum.b / light),
    };
  }
  let top: { n: number; r: number; g: number; b: number } | null = null;
  for (const bin of bins.values()) if (!top || bin.n > top.n) top = bin;
  if (!top || top.n < total * 0.05) return null;
  return {
    r: Math.round(top.r / top.n),
    g: Math.round(top.g / top.n),
    b: Math.round(top.b / top.n),
  };
}

// ---------------------------------------------------------------------------
// Drawing it.

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(c: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

export const css = (c: Rgb, alpha = 1) =>
  alpha >= 1 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;

/** Plain style objects (React accepts them as `style`); no React import here. */
export type SwatchStyle = {
  panel: Record<string, string>;
  text: Record<string, string>;
  /** "על קטיפה", "על דמוי עור" — only when the name said the material. */
  onMaterial: string | null;
};

const MATERIAL_LABEL: Record<SurfaceMaterial, string> = {
  leather: "דמוי עור",
  linen: "פשתן",
  velvet: "קטיפה",
  corduroy: "קורדרוי",
  suede: "סוויד",
  tweed: "טוויד",
  denim: "ג'ינס",
  satin: "סאטן",
  fabric: "בד",
  wood: "עץ",
  acrylic: "אקריליק",
  metal: "מתכת",
};

// Texture layers over the base colour. Kept as separate background-image /
// size / position lists (not the `background` shorthand), so the base colour
// stays a plain background-color the swatch can fade when the photo is read.
type Layer = { image: string; size?: string; position?: string };

const TEXTURE: Record<SurfaceMaterial, (dark: boolean) => Layer[]> = {
  linen: () => [
    { image: "repeating-linear-gradient(45deg, rgba(90,70,30,0.06) 0 1px, transparent 1px 5px)" },
    { image: "repeating-linear-gradient(-45deg, rgba(90,70,30,0.05) 0 1px, transparent 1px 5px)" },
    { image: "linear-gradient(160deg, rgba(255,255,255,0.18), rgba(0,0,0,0.04))" },
  ],
  fabric: () => [
    { image: "repeating-linear-gradient(0deg, rgba(0,0,0,0.04) 0 1px, transparent 1px 3px)" },
    { image: "repeating-linear-gradient(90deg, rgba(0,0,0,0.04) 0 1px, transparent 1px 3px)" },
    { image: "linear-gradient(160deg, rgba(255,255,255,0.14), rgba(0,0,0,0.05))" },
  ],
  velvet: (dark) => [
    {
      image: `radial-gradient(120% 90% at 28% 18%, rgba(255,255,255,${dark ? 0.16 : 0.22}), transparent 60%)`,
    },
    { image: "radial-gradient(140% 110% at 75% 115%, rgba(0,0,0,0.32), transparent 62%)" },
  ],
  leather: (dark) => [
    {
      image: `radial-gradient(rgba(0,0,0,${dark ? 0.22 : 0.07}) 1px, transparent 1.4px)`,
      size: "5px 5px",
    },
    {
      image: `radial-gradient(rgba(255,255,255,${dark ? 0.05 : 0.12}) 1px, transparent 1.4px)`,
      size: "6px 6px",
      position: "2px 3px",
    },
    {
      image: `linear-gradient(160deg, rgba(255,255,255,${dark ? 0.12 : 0.2}), transparent 48%, rgba(0,0,0,0.12))`,
    },
  ],
  corduroy: () => [
    {
      image:
        "repeating-linear-gradient(90deg, rgba(0,0,0,0.14) 0 2px, rgba(255,255,255,0.07) 2px 4px, transparent 4px 7px)",
    },
    { image: "linear-gradient(160deg, rgba(255,255,255,0.12), rgba(0,0,0,0.1))" },
  ],
  suede: () => [
    {
      image:
        "repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 4px)",
    },
    { image: "radial-gradient(120% 100% at 30% 20%, rgba(255,255,255,0.1), transparent 60%)" },
  ],
  tweed: () => [
    {
      image: "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 3px)",
    },
    { image: "repeating-linear-gradient(-45deg, rgba(0,0,0,0.09) 0 1px, transparent 1px 3px)" },
  ],
  denim: () => [
    {
      image: "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 4px)",
    },
    { image: "linear-gradient(160deg, rgba(255,255,255,0.1), rgba(0,0,0,0.12))" },
  ],
  satin: () => [
    {
      image:
        "linear-gradient(115deg, rgba(255,255,255,0) 18%, rgba(255,255,255,0.32) 44%, rgba(255,255,255,0) 70%)",
    },
    { image: "linear-gradient(160deg, rgba(0,0,0,0), rgba(0,0,0,0.08))" },
  ],
  wood: () => [
    { image: "repeating-linear-gradient(90deg, rgba(74,58,34,0.07) 0 1px, transparent 1px 7px)" },
    { image: "linear-gradient(160deg, rgba(255,255,255,0.16), rgba(0,0,0,0.08))" },
  ],
  acrylic: () => [
    {
      image:
        "linear-gradient(160deg, rgba(255,255,255,0.6), rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.35))",
    },
  ],
  metal: () => [
    {
      image: "repeating-linear-gradient(90deg, rgba(255,255,255,0.09) 0 1px, transparent 1px 3px)",
    },
    { image: "linear-gradient(160deg, rgba(255,255,255,0.3), rgba(0,0,0,0.18))" },
  ],
};

const GOLD = { onDark: hex("#e4c46c"), onLight: hex("#9c7a2a") };
const SILVER = { onDark: hex("#dfe2e6"), onLight: hex("#737a83") };

/** Panel and lettering for a technique on a surface. */
export function swatchStyle(surface: Surface, technique: Technique): SwatchStyle {
  const base = surface.color;
  const dark = luminance(base) < 0.2;
  const layers = TEXTURE[surface.material](dark);
  const panel: Record<string, string> = {
    backgroundColor: css(base),
    backgroundImage: layers.map((l) => l.image).join(", "),
    backgroundSize: layers.map((l) => l.size ?? "auto").join(", "),
    backgroundPosition: layers.map((l) => l.position ?? "0 0").join(", "),
    boxShadow: [
      `inset 0 1px 0 rgba(255,255,255,${dark ? 0.12 : 0.5})`,
      `inset 0 0 0 1px rgba(0,0,0,${dark ? 0.3 : 0.12})`,
      "0 10px 30px -16px rgba(22,24,29,0.22)",
    ].join(", "),
  };

  let text: Record<string, string>;
  if (technique === "embroidery") {
    const metal = surface.accent === "silver" ? SILVER : GOLD;
    text = {
      color: css(dark ? metal.onDark : metal.onLight),
      // Raised thread: a lit top edge and a soft drop below.
      textShadow: dark
        ? "0 -1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.7)"
        : "0 -1px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(60,45,20,0.45)",
    };
  } else if (technique === "print") {
    // Foil pressed INTO the cover: a metallic fill, a dark upper edge and a lit
    // lower one, the reverse of the raised thread.
    // Deeper foil on a light cover, or silver on white all but disappears.
    const foil =
      surface.accent === "silver"
        ? dark
          ? "linear-gradient(180deg, #f4f6f8, #b9bec5 55%, #8b9199)"
          : "linear-gradient(180deg, #c3c9cf, #858c95 55%, #5d646d)"
        : dark
          ? "linear-gradient(180deg, #f6e3a1, #cfa94a 55%, #9c7726)"
          : "linear-gradient(180deg, #e2c46e, #b08a2c 55%, #84641c)";
    text = {
      color: css(surface.accent === "silver" ? SILVER.onDark : GOLD.onDark),
      backgroundImage: foil,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: dark
        ? "drop-shadow(0 -1px 0 rgba(0,0,0,0.6)) drop-shadow(0 1px 0 rgba(255,255,255,0.12))"
        : "drop-shadow(0 -1px 0 rgba(0,0,0,0.35)) drop-shadow(0 1px 0 rgba(255,255,255,0.5))",
    };
  } else {
    // Laser marks the material itself: a dark burn on wood and light leather,
    // a pale mark on dark leather and fabric, frost on acrylic, black on metal.
    let mark: Rgb;
    if (surface.material === "wood") mark = hex("#43341e");
    else if (surface.material === "acrylic") mark = hex("#f7fafc");
    else if (surface.material === "metal") mark = hex("#2a2a2c");
    else mark = dark ? mix(base, hex("#d8d4cc"), 0.55) : mix(base, hex("#2e2216"), 0.62);
    const frost = surface.material === "acrylic";
    text = {
      color: css(mark),
      textShadow: frost
        ? "0 0 1px rgba(40,50,60,0.45), 0 0 6px rgba(255,255,255,0.7)"
        : dark
          ? "0 1px 0 rgba(255,255,255,0.08), 0 -1px 0 rgba(0,0,0,0.55)"
          : "0 1px 0 rgba(255,255,255,0.5), 0 -1px 1px rgba(0,0,0,0.3)",
    };
  }

  return {
    panel,
    text,
    onMaterial: surface.materialFrom === "name" ? `על ${MATERIAL_LABEL[surface.material]}` : null,
  };
}

/**
 * How large the name is set: a short name fills the swatch, a 60-character
 * dedication still fits on two or three lines.
 */
export function nameSize(text: string): "xl" | "lg" | "md" | "sm" {
  const n = [...text.trim()].length;
  if (n <= 12) return "xl";
  if (n <= 24) return "lg";
  if (n <= 40) return "md";
  return "sm";
}
