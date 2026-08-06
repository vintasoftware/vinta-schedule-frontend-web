import { useMutation } from '@tanstack/react-query';
import {
  getBrandingLogoUploadParams,
  type BrandingLogoUploadParams,
} from '@/lib/branding-logo-upload-params';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export class UploadValidationError extends Error {}

/**
 * `endpoint` is only set for S3-compatible backends signed with a custom
 * endpoint (path-style URL). Plain AWS S3 returns `endpoint: null` — build the
 * standard virtual-hosted-style URL from `bucket`/`region` instead.
 */
function buildUploadUrl(params: BrandingLogoUploadParams): string {
  if (params.endpoint) {
    return `${params.endpoint}/${params.bucket}/${params.object_key}`;
  }

  if (!params.bucket || !params.region) {
    throw new Error('Upload params are missing bucket/region for S3 URL');
  }

  return `https://${params.bucket}.s3.${params.region}.amazonaws.com/${params.object_key}`;
}

function uploadToS3(
  params: BrandingLogoUploadParams,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = buildUploadUrl(params);
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
      getBrandingLogoUploadParams({
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
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
