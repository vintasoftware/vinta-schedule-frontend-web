import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlSearchParamsBodySerializer } from '@/client/client';

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}));

vi.mock('@/client/client.gen', () => ({
  client: { request: mockRequest },
}));

import { getS3DirectUploadParams } from './s3direct-get-upload-params';

const UPLOAD_PARAMS = {
  object_key: 'uploads/branding_logos/test-logo.png',
  access_key_id: 'AKIA',
  session_token: null,
  region: 'us-east-1',
  bucket: 'media-bucket',
  endpoint: 'https://s3.example.com',
  acl: 'private',
  allow_existence_optimization: false,
};

describe('getS3DirectUploadParams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest.mockResolvedValue({
      response: { ok: true, status: 200 },
      data: UPLOAD_PARAMS,
    });
  });

  it('posts form-urlencoded body with dest=branding_logos', async () => {
    await getS3DirectUploadParams({
      dest: 'branding_logos',
      name: 'logo.png',
      type: 'image/png',
      size: 1024,
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/s3direct/get_upload_params/',
        body: {
          dest: 'branding_logos',
          name: 'logo.png',
          type: 'image/png',
          size: '1024',
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        parseAs: 'json',
        bodySerializer: urlSearchParamsBodySerializer.bodySerializer,
      })
    );

    const callArgs = mockRequest.mock.calls[0]?.[0];
    const serialized = urlSearchParamsBodySerializer.bodySerializer!(
      callArgs.body
    );
    expect(serialized).toContain('dest=branding_logos');
    expect(serialized).toContain('name=logo.png');
    expect(serialized).toContain('type=image%2Fpng');
    expect(serialized).toContain('size=1024');
  });

  it('returns signed upload params on success', async () => {
    const params = await getS3DirectUploadParams({
      dest: 'branding_logos',
      name: 'logo.png',
      type: 'image/png',
      size: 512,
    });

    expect(params).toEqual(UPLOAD_PARAMS);
  });

  it('throws s3direct error message from result.error on failure', async () => {
    mockRequest.mockResolvedValue({
      response: { ok: false, status: 400 },
      error: { error: 'Invalid file type' },
    });

    await expect(
      getS3DirectUploadParams({
        dest: 'branding_logos',
        name: 'logo.png',
        type: 'image/png',
        size: 512,
      })
    ).rejects.toThrow('Invalid file type');
  });

  it('falls back to result.data error message when result.error is absent', async () => {
    mockRequest.mockResolvedValue({
      response: { ok: false, status: 400 },
      data: { error: 'File too large' },
    });

    await expect(
      getS3DirectUploadParams({
        dest: 'branding_logos',
        name: 'logo.png',
        type: 'image/png',
        size: 512,
      })
    ).rejects.toThrow('File too large');
  });
});
