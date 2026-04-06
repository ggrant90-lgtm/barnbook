import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE = join(ROOT, "public", "logo.png");
const ICONS_DIR = join(ROOT, "public", "icons");
const SPLASH_DIR = join(ROOT, "public", "splash");

mkdirSync(ICONS_DIR, { recursive: true });
mkdirSync(SPLASH_DIR, { recursive: true });

async function generateIcons() {
  console.log("Generating PWA icons from", SOURCE);

  // Standard icons
  const sizes = [16, 32, 180, 192, 512];
  for (const size of sizes) {
    const name =
      size === 180
        ? "apple-touch-icon.png"
        : size <= 32
          ? `favicon-${size}.png`
          : `icon-${size}.png`;

    await sharp(SOURCE)
      .resize(size, size, { fit: "contain", background: { r: 245, g: 239, b: 228, alpha: 1 } })
      .png()
      .toFile(join(ICONS_DIR, name));

    console.log(`  ✓ ${name} (${size}x${size})`);
  }

  // Maskable icons (10% padding on each side = logo at 80% of canvas)
  for (const size of [192, 512]) {
    const logoSize = Math.round(size * 0.8);
    const logo = await sharp(SOURCE)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 245, g: 239, b: 228, alpha: 1 } })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 245, g: 239, b: 228, alpha: 1 },
      },
    })
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toFile(join(ICONS_DIR, `icon-maskable-${size}.png`));

    console.log(`  ✓ icon-maskable-${size}.png (${size}x${size})`);
  }

  // Shortcut icons (96x96)
  for (const name of ["shortcut-barns.png", "shortcut-calendar.png"]) {
    await sharp(SOURCE)
      .resize(96, 96, { fit: "contain", background: { r: 245, g: 239, b: 228, alpha: 1 } })
      .png()
      .toFile(join(ICONS_DIR, name));

    console.log(`  ✓ ${name} (96x96)`);
  }

  // Favicon ICO (just copy the 32px as ico — browsers accept PNG favicons)
  await sharp(SOURCE)
    .resize(32, 32, { fit: "contain", background: { r: 245, g: 239, b: 228, alpha: 1 } })
    .png()
    .toFile(join(ICONS_DIR, "favicon.png"));

  // Splash screens — logo centered on parchment background
  const splashSizes = [
    { name: "iphone-se", w: 640, h: 1136 },
    { name: "iphone-14", w: 828, h: 1792 },
    { name: "iphone-14-pro", w: 1179, h: 2556 },
    { name: "iphone-14-pro-max", w: 1290, h: 2796 },
    { name: "ipad", w: 1668, h: 2388 },
  ];

  for (const { name, w, h } of splashSizes) {
    const logoSize = Math.round(Math.min(w, h) * 0.3);
    const logo = await sharp(SOURCE)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 245, g: 239, b: 228, alpha: 1 } })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: { r: 245, g: 239, b: 228, alpha: 1 },
      },
    })
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toFile(join(SPLASH_DIR, `${name}.png`));

    console.log(`  ✓ splash/${name}.png (${w}x${h})`);
  }

  console.log("\nDone! All icons and splash screens generated.");
}

generateIcons().catch(console.error);
