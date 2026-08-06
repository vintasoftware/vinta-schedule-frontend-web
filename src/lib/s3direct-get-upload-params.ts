import { client } from '@/client/client.gen';
import type { ProfilePictureUploadParams } from '@/client';

export type S3DirectUploadParamsRequest = {
  dest: string;
  name: string;
  type: string;
  size: number;
};

type S3DirectErrorResponse = {
  error?: string;
};

/**
 * Request signed S3 upload params from django-s3direct's signing view
 * (`POST /s3direct/get_upload_params/`). Uses form-encoded fields (`dest`,
 * `name`, `type`, `size`) — the raw s3direct contract, not the JSON
 * profile-picture wrapper endpoint.
 */
export async function getS3DirectUploadParams(
  request: S3DirectUploadParamsRequest
): Promise<ProfilePictureUploadParams> {
  const body = new URLSearchParams({
    dest: request.dest,
    name: request.name,
    type: request.type,
    size: String(request.size),
  });

  const result = await client.request({
    method: 'POST',
    url: '/s3direct/get_upload_params/',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    parseAs: 'json',
  });

  if (!result.response?.ok) {
    const errorBody = result.data as S3DirectErrorResponse | undefined;
    throw new Error(
      errorBody?.error ??
        `Failed to get upload params (${result.response?.status ?? 'unknown'})`
    );
  }

  return result.data as ProfilePictureUploadParams;
}
