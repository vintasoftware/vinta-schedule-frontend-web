import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}));

vi.mock('@/client/client.gen', () => ({
  client: { request: mockRequest },
}));

import { getBrandingLogoUploadParams } from './branding-logo-upload-params';

const UPLOAD_PARAMS = {
  object_key: 'uploads/branding_logos/test-logo.png',
  access_key_id: 'AKIA',
  session_token: null,
  region: 'us-east-1',
  bucket: 'media-bucket',
  endpoint: 'https://s3.example.com',
  acl: 'private',
};

describe('getBrandingLogoUploadParams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest.mockResolvedValue({
      response: { ok: true, status: 200 },
      data: UPLOAD_PARAMS,
    });
  });

  it('posts a JSON body to the JWT-authenticated branding logo upload-params endpoint', async () => {
    await getBrandingLogoUploadParams({
      file_name: 'logo.png',
      file_type: 'image/png',
      file_size: 1024,
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/branding/logo-upload-params/',
        body: {
          file_name: 'logo.png',
          file_type: 'image/png',
          file_size: 1024,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        parseAs: 'json',
      })
    );
  });

  it('returns signed upload params on success', async () => {
    const params = await getBrandingLogoUploadParams({
      file_name: 'logo.png',
      file_type: 'image/png',
      file_size: 512,
    });

    expect(params).toEqual(UPLOAD_PARAMS);
  });

  it('throws the message from a bare validation-error array on 400', async () => {
    mockRequest.mockResolvedValue({
      response: { ok: false, status: 400 },
      error: [
        'Invalid file type (image/svg+xml). Allowed types: image/png, image/jpeg, image/webp.',
      ],
    });

    await expect(
      getBrandingLogoUploadParams({
        file_name: 'logo.svg',
        file_type: 'image/svg+xml',
        file_size: 512,
      })
    ).rejects.toThrow('Invalid file type (image/svg+xml)');
  });

  it('throws the detail message when the acting organization is not eligible', async () => {
    mockRequest.mockResolvedValue({
      response: { ok: false, status: 403 },
      error: {
        detail:
          "This organization's plan does not include white-label branding.",
      },
    });

    await expect(
      getBrandingLogoUploadParams({
        file_name: 'logo.png',
        file_type: 'image/png',
        file_size: 512,
      })
    ).rejects.toThrow('white-label branding');
  });

  it('falls back to result.data detail message when result.error is absent', async () => {
    mockRequest.mockResolvedValue({
      response: { ok: false, status: 400 },
      data: { detail: 'X-Organization-Id header required.' },
    });

    await expect(
      getBrandingLogoUploadParams({
        file_name: 'logo.png',
        file_type: 'image/png',
        file_size: 512,
      })
    ).rejects.toThrow('X-Organization-Id header required.');
  });

  it('falls back to a status-based message when no error body is present', async () => {
    mockRequest.mockResolvedValue({
      response: { ok: false, status: 403 },
      data: undefined,
    });

    await expect(
      getBrandingLogoUploadParams({
        file_name: 'logo.png',
        file_type: 'image/png',
        file_size: 512,
      })
    ).rejects.toThrow('Failed to get branding logo upload params (403)');
  });
});
