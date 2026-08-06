import { client } from '@/client/client.gen';

export type BrandingLogoUploadParams = {
  object_key: string;
  access_key_id: string | null;
  session_token: string | null;
  region: string | null;
  bucket: string | null;
  endpoint: string | null;
  acl: string;
};

export type BrandingLogoUploadParamsRequest = {
  file_name: string;
  file_type: string;
  file_size: number;
};

/**
 * Request signed S3 upload params for the `branding_logos` destination from our
 * own JWT-authenticated endpoint (`POST /branding/logo-upload-params/`).
 *
 * Deliberately does NOT call the shipped s3direct signing view
 * (`/s3direct/get_upload_params/`) directly: that view ships with the
 * `django-s3direct` package and sits outside DRF, so it never sees this SPA's
 * `Authorization: Bearer` header — only a Django session cookie, which this
 * JWT-only app never sets. It always resolves to an anonymous user and the
 * `branding_logos` destination's auth check always 403s. See the backend
 * handoff `.vinta-ai-workflows/client-handoffs/2026-08-06-branding-logo-upload-params-endpoint.md`
 * for the full diagnosis and the endpoint this function targets.
 */
export async function getBrandingLogoUploadParams(
  request: BrandingLogoUploadParamsRequest
): Promise<BrandingLogoUploadParams> {
  const result = await client.request({
    method: 'POST',
    url: '/branding/logo-upload-params/',
    body: request,
    headers: {
      'Content-Type': 'application/json',
    },
    parseAs: 'json',
  });

  if (!result.response?.ok) {
    throw new Error(
      extractBrandingLogoUploadParamsError(result.error ?? result.data) ??
        `Failed to get branding logo upload params (${result.response?.status ?? 'unknown'})`
    );
  }

  return result.data as BrandingLogoUploadParams;
}

/**
 * 400 validation errors come back as a bare JSON array of one message
 * (not wrapped in `detail`); every other error is `{ detail: string }`.
 */
function extractBrandingLogoUploadParamsError(body: unknown): string | null {
  if (Array.isArray(body) && typeof body[0] === 'string') {
    return body[0];
  }

  if (body !== null && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string') {
      return detail;
    }
  }

  return null;
}
