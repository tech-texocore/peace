const MAX_HEIGHT = 400;
const MAX_WIDTH = 2000;

// Trims empty margins so the size settings control the visible logo; SVG is left as is.
export async function prepareLogo(file: File): Promise<File> {
  if (!/^image\/(png|webp|jpe?g)$/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  const src = document.createElement("canvas");
  src.width = bitmap.width;
  src.height = bitmap.height;
  const ctx = src.getContext("2d", { willReadFrequently: true });
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0);
  const { data, width: w, height: h } = ctx.getImageData(0, 0, src.width, src.height);

  const [r0, g0, b0, a0] = [data[0], data[1], data[2], data[3]];
  const isEmpty = (i: number) =>
    data[i + 3] < 10 || (a0 >= 10 && Math.abs(data[i] - r0) + Math.abs(data[i + 1] - g0) + Math.abs(data[i + 2] - b0) < 30);

  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isEmpty((y * w + x) * 4)) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < 0) return file;

  const pad = Math.round((bottom - top + 1) * 0.04);
  top = Math.max(0, top - pad);
  left = Math.max(0, left - pad);
  bottom = Math.min(h - 1, bottom + pad);
  right = Math.min(w - 1, right + pad);
  const cw = right - left + 1;
  const ch = bottom - top + 1;
  const scale = Math.min(1, MAX_HEIGHT / ch, MAX_WIDTH / cw);

  const out = document.createElement("canvas");
  out.width = Math.round(cw * scale);
  out.height = Math.round(ch * scale);
  const octx = out.getContext("2d");
  if (!octx) return file;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(src, left, top, cw, ch, 0, 0, out.width, out.height);

  const type = file.type === "image/jpeg" || file.type === "image/jpg" ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, type, 0.92));
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + (type === "image/jpeg" ? ".jpg" : ".png");
  return new File([blob], name, { type });
}
