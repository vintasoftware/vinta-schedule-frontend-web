import { useMutation } from '@tanstack/react-query';
import { profileProfilePictureUploadParamsCreateMutation } from '@/client/@tanstack/react-query.gen';
import type { ProfilePictureUploadParams } from '@/client';

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export class UploadValidationError extends Error {}

function uploadToS3(
  params: ProfilePictureUploadParams,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
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

    // `upload_url` is a complete presigned PUT URL. Content-Type is part of
    // what the backend signed, so it has to be sent and has to match the file
    // exactly; any other header would break the signature.
    xhr.open('PUT', params.upload_url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

export function useUploadProfilePicture() {
  const getUploadParams = useMutation(
    profileProfilePictureUploadParamsCreateMutation()
  );

  /** Validates, uploads to S3, and returns the object key. Does NOT patch the profile. */
  const uploadProfilePicture = async (
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<string> => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      throw new UploadValidationError(
        'Only JPEG, PNG, WebP, and GIF images are allowed'
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new UploadValidationError('Image must be smaller than 5 MB');
    }

    const params = await getUploadParams.mutateAsync({
      path: { user: 'me' },
      body: {
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      },
    });

    await uploadToS3(params, file, onProgress ?? (() => {}));

    // The bucket is private and served through signed URLs, so there is no
    // public URL to build here — the profile takes the S3 key.
    return params.object_key;
  };

  return { uploadProfilePicture };
}
