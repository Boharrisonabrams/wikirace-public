import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const master = path.join(root, "artifacts/brand/wikirace-monogram-master.png");
const mobile = path.join(root, "artifacts/mobile/assets/images");
const web = path.join(root, "artifacts/web/public");
const cream = "#f5f2eb";

await mkdir(path.join(root, "artifacts/brand"), { recursive: true });
await mkdir(path.join(web, "icons"), { recursive: true });

async function square(size, output) {
  await sharp(master)
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function transparentMonogram(size, monochrome = false) {
  const { data, info } = await sharp(master)
    .resize(size, size, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let input = 0, output = 0; input < data.length; input += 3, output += 4) {
    const red = data[input] ?? 0;
    const green = data[input + 1] ?? 0;
    const blue = data[input + 2] ?? 0;
    const alpha = Math.max(0, Math.min(255, Math.round((red - Math.max(green, blue) - 8) * 5)));
    rgba[output] = monochrome ? 255 : red;
    rgba[output + 1] = monochrome ? 255 : green;
    rgba[output + 2] = monochrome ? 255 : blue;
    rgba[output + 3] = alpha;
  }

  return sharp(rgba, {
    raw: { channels: 4, height: info.height, width: info.width },
  }).png({ compressionLevel: 9 });
}

await Promise.all([
  square(1024, path.join(mobile, "icon.png")),
  square(228, path.join(mobile, "splash-icon.png")),
  square(48, path.join(mobile, "favicon.png")),
  square(64, path.join(web, "favicon.png")),
  square(192, path.join(web, "icons/icon-192.png")),
  square(512, path.join(web, "icons/icon-512.png")),
  square(512, path.join(web, "icons/icon-512-maskable.png")),
  sharp({
    create: { background: cream, channels: 3, height: 512, width: 512 },
  })
    .png({ compressionLevel: 9 })
    .toFile(path.join(mobile, "android-icon-background.png")),
  transparentMonogram(512).then((image) =>
    image.toFile(path.join(mobile, "android-icon-foreground.png"))
  ),
  transparentMonogram(432, true).then((image) =>
    image.toFile(path.join(mobile, "android-icon-monochrome.png"))
  ),
]);

const socialMonogram = await transparentMonogram(520).then((image) => image.toBuffer());
const border = Buffer.from(
  '<svg width="1200" height="630"><rect x="22" y="22" width="1156" height="586" rx="8" fill="none" stroke="#c94f2f" stroke-width="2"/></svg>'
);
await sharp({
  create: { background: cream, channels: 3, height: 630, width: 1200 },
})
  .composite([
    { input: socialMonogram, left: 340, top: 55 },
    { input: border, left: 0, top: 0 },
  ])
  .jpeg({ chromaSubsampling: "4:4:4", quality: 92 })
  .toFile(path.join(web, "wikirace-share-card.jpg"));
