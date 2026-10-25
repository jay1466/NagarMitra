import { apiPost } from './client';
// Use legacy import to support uploadAsync on SDK 54
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';

export async function getPresignedUrl({ contentType, prefix = 'complaints/' }) {
  return apiPost('/api/v1/media/presign', { contentType, prefix });
}

export async function uploadToPresignedUrl({ uploadUrl, fileUri, contentType }) {
  // Use standard fetch and Blob to avoid network errors associated with expo legacy uploadAsync
  const response = await fetch(fileUri);
  const blob = await response.blob();
  
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }
  return true;
}
