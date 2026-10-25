import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Shrink a photo and return it as a JPEG data URI small enough to store with
// the report (the backend accepts up to ~1.1 MB per image).
export async function toCompressedDataUri(uri, { maxWidth = 1024, quality = 0.6 } = {}) {
  const result = await manipulateAsync(uri, [{ resize: { width: maxWidth } }], {
    compress: quality,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return `data:image/jpeg;base64,${result.base64}`;
}
