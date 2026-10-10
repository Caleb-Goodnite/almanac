import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * Draws the Android and iOS icons and splash screens straight into the
 * native projects. Same mark as the web icon (app/icons): an ink "A" on paper
 * with the vermilion full stop.
 *
 *   pnpm exec tsx scripts/build-mobile-icons.tsx
 */
const PAPER = "#f4f0e8";
const INK = "#1a1814";
const RES = "android/app/src/main/res";
const IOS = "ios/App/App/Assets.xcassets";

/** `markPx` is the height of the letter; the image can be any shape. */
function mark(width: number, height: number, markPx: number, background: string | null, round = false) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: background ?? "transparent", borderRadius: round ? "50%" : 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", color: INK, fontSize: markPx, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
          A
          <div style={{ width: markPx * 0.16, height: markPx * 0.16, borderRadius: "50%", background: "#d9481c", marginLeft: markPx * 0.0125 }} />
        </div>
      </div>
    ),
    { width, height },
  );
}

async function save(file: string, image: ImageResponse, root = RES) {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await image.arrayBuffer()));
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 } as const;
const SPLASH_SHORT = { mdpi: 320, hdpi: 480, xhdpi: 720, xxhdpi: 960, xxxhdpi: 1280 } as const;
const SPLASH_LONG = { mdpi: 480, hdpi: 800, xhdpi: 1280, xxhdpi: 1600, xxxhdpi: 1920 } as const;

async function main() {
  for (const [name, scale] of Object.entries(DENSITIES) as [keyof typeof DENSITIES, number][]) {
    const icon = 48 * scale;
    await save(`mipmap-${name}/ic_launcher.png`, mark(icon, icon, icon * 0.8, PAPER));
    await save(`mipmap-${name}/ic_launcher_round.png`, mark(icon, icon, icon * 0.7, PAPER, true));
    // Adaptive icons are cropped to roughly the middle two thirds, so the mark is drawn smaller.
    const layer = 108 * scale;
    await save(`mipmap-${name}/ic_launcher_foreground.png`, mark(layer, layer, layer * 0.42, null));

    const short = SPLASH_SHORT[name];
    const long = SPLASH_LONG[name];
    await save(`drawable-port-${name}/splash.png`, mark(short, long, short * 0.3, PAPER));
    await save(`drawable-land-${name}/splash.png`, mark(long, short, short * 0.3, PAPER));
  }
  await save("drawable/splash.png", mark(480, 320, 96, PAPER));
  // iOS: one 1024 px icon (no transparency allowed) and a square splash the launch screen centres and crops.
  await save("AppIcon.appiconset/AppIcon-512@2x.png", mark(1024, 1024, 1024 * 0.8, PAPER), IOS);
  for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    await save(`Splash.imageset/${name}`, mark(2732, 2732, 2732 * 0.12, PAPER), IOS);
  }

  await writeFile(
    path.join(RES, "values/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${PAPER}</color>\n</resources>\n`,
  );
}

void main();
