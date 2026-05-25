import exifr from "exifr";

const THUMBNAIL_MAX_SIZE = 720;
const THUMBNAIL_QUALITY = 0.78;

export async function buildImageAttachment(file, kind = "image") {
  const dataUrl = await readAsDataUrl(file);
  const metadata = await readPhotoMetadata(file).catch(() => ({}));
  const thumbnailDataUrl = await createThumbnailDataUrl(file).catch(() => dataUrl);

  return {
    kind,
    name: file.name,
    mimeType: file.type,
    dataUrl,
    thumbnailDataUrl,
    captureTime: metadata.captureTime ?? null,
    gpsLatitude: metadata.gpsLatitude ?? null,
    gpsLongitude: metadata.gpsLongitude ?? null
  };
}

async function readPhotoMetadata(file) {
  const parsed = await exifr.parse(file, {
    gps: true,
    tiff: true,
    ifd0: true,
    exif: true,
    pick: ["latitude", "longitude", "DateTimeOriginal", "CreateDate", "ModifyDate", "DateTime"]
  });

  return {
    gpsLatitude: numberOrNull(parsed?.latitude),
    gpsLongitude: numberOrNull(parsed?.longitude),
    captureTime: normalizeDateValue(parsed?.DateTimeOriginal ?? parsed?.CreateDate ?? parsed?.DateTime ?? parsed?.ModifyDate)
  };
}

function normalizeDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function createThumbnailDataUrl(file) {
  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, THUMBNAIL_MAX_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", THUMBNAIL_QUALITY);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
