import { client } from '@/client/client.gen';
import { urlSearchParamsBodySerializer } from '@/client/client';

export type S3DirectUploadParamsRequest = {
  dest: string;
  name: string;
  type: string;
  size: number;
};

/**
 * What django-s3direct's signing view answers with. Declared here rather than
 * imported from the generated client: the view lives outside the OpenAPI
 * schema, and the profile-picture endpoint that used to mirror this shape now
 * returns a presigned PUT URL instead.
 */
export type S3DirectUploadParams = {
  object_key: string;
  access_key_id: string | null;
  session_token: string | null;
  region: string;
  bucket: string;
  endpoint: string;
  acl: string;
  allow_existence_optimization: boolean;
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
): Promise<S3DirectUploadParams> {
  const result = await client.request({
    ...urlSearchParamsBodySerializer,
    method: 'POST',
    url: '/s3direct/get_upload_params/',
    body: {
      dest: request.dest,
      name: request.name,
      type: request.type,
      size: String(request.size),
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    parseAs: 'json',
  });

  if (!result.response?.ok) {
    const errorBody =
      (result.error as S3DirectErrorResponse | undefined) ??
      (result.data as S3DirectErrorResponse | undefined);
    throw new Error(
      errorBody?.error ??
        `Failed to get upload params (${result.response?.status ?? 'unknown'})`
    );
  }

  return result.data as S3DirectUploadParams;
}
