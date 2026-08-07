import { useMutation } from '@tanstack/react-query';
import {
  getS3DirectUploadParams,
  type S3DirectUploadParams,
} from '@/lib/s3direct-get-upload-params';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const BRANDING_LOGOS_DEST = 'branding_logos';

export class UploadValidationError extends Error {}

function uploadToS3(
  params: S3DirectUploadParams,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `${params.endpoint}/${params.bucket}/${params.object_key}`;
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    if (params.acl) {
      xhr.setRequestHeader('x-amz-acl', params.acl);
    }
    xhr.send(file);
  });
}

function validateLogoFile(file: File): void {
  if (
    file.type === 'image/svg+xml' ||
    file.name.toLowerCase().endsWith('.svg')
  ) {
    throw new UploadValidationError('SVG images are not allowed');
  }

  if (
    !ACCEPTED_IMAGE_TYPES.includes(
      file.type as (typeof ACCEPTED_IMAGE_TYPES)[number]
    )
  ) {
    throw new UploadValidationError(
      'Only PNG, JPEG, and WebP images are allowed'
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new UploadValidationError('Image must be smaller than 5 MB');
  }
}

export function useUploadBrandingLogo() {
  const getUploadParams = useMutation({
    mutationFn: (file: File) =>
      getS3DirectUploadParams({
        dest: BRANDING_LOGOS_DEST,
        name: file.name,
        type: file.type,
        size: file.size,
      }),
  });

  /** Validates, uploads to S3, and returns the object key for branding PUT. */
  const uploadBrandingLogo = async (
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<string> => {
    validateLogoFile(file);

    const params = await getUploadParams.mutateAsync(file);
    await uploadToS3(params, file, onProgress ?? (() => {}));

    return params.object_key;
  };

  return { uploadBrandingLogo };
}
