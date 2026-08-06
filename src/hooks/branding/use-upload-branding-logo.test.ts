import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

const { mockGetS3DirectUploadParams } = vi.hoisted(() => ({
  mockGetS3DirectUploadParams: vi.fn(),
}));

vi.mock('@/lib/s3direct-get-upload-params', () => ({
  getS3DirectUploadParams: mockGetS3DirectUploadParams,
}));

import {
  useUploadBrandingLogo,
  UploadValidationError,
} from './use-upload-branding-logo';

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

function makePngFile(name: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: 'image/png' });
}

describe('useUploadBrandingLogo', () => {
  let xhrInstances: MockXMLHttpRequest[];
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  class MockXMLHttpRequest {
    static OPEN = 'OPEN';
    static SENT = 'SENT';

    upload = {
      addEventListener: vi.fn(),
    };
    addEventListener = vi.fn();
    open = vi.fn();
    setRequestHeader = vi.fn();
    send = vi.fn();
    status = 200;
    state = MockXMLHttpRequest.OPEN;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    xhrInstances = [];
    mockGetS3DirectUploadParams.mockResolvedValue(UPLOAD_PARAMS);

    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(function MockXHR(this: MockXMLHttpRequest) {
        const xhr = new MockXMLHttpRequest();
        xhrInstances.push(xhr);

        xhr.send.mockImplementation(() => {
          xhr.state = MockXMLHttpRequest.SENT;
          const loadHandler = xhr.addEventListener.mock.calls.find(
            ([event]) => event === 'load'
          )?.[1] as (() => void) | undefined;
          loadHandler?.();
        });

        return xhr;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects SVG before requesting upload params', async () => {
    const { result } = renderHook(() => useUploadBrandingLogo(), { wrapper });
    const svgFile = new File(['<svg></svg>'], 'logo.svg', {
      type: 'image/svg+xml',
    });

    await expect(
      act(async () => result.current.uploadBrandingLogo(svgFile))
    ).rejects.toThrow(UploadValidationError);

    expect(mockGetS3DirectUploadParams).not.toHaveBeenCalled();
    expect(xhrInstances).toHaveLength(0);
  });

  it('rejects .svg extension even when MIME type is not SVG', async () => {
    const { result } = renderHook(() => useUploadBrandingLogo(), { wrapper });
    const disguisedSvg = new File(['fake'], 'logo.svg', { type: 'image/png' });

    await expect(
      act(async () => result.current.uploadBrandingLogo(disguisedSvg))
    ).rejects.toThrow(UploadValidationError);

    expect(mockGetS3DirectUploadParams).not.toHaveBeenCalled();
    expect(xhrInstances).toHaveLength(0);
  });

  it('rejects oversized files before requesting upload params', async () => {
    const { result } = renderHook(() => useUploadBrandingLogo(), { wrapper });
    const oversized = makePngFile('big.png', 5 * 1024 * 1024 + 1);

    await expect(
      act(async () => result.current.uploadBrandingLogo(oversized))
    ).rejects.toThrow(UploadValidationError);

    expect(mockGetS3DirectUploadParams).not.toHaveBeenCalled();
    expect(xhrInstances).toHaveLength(0);
  });

  it('signs via s3direct branding_logos and returns the object key', async () => {
    const { result } = renderHook(() => useUploadBrandingLogo(), { wrapper });
    const file = makePngFile('logo.png', 1024);
    const onProgress = vi.fn();

    const objectKey = await act(async () =>
      result.current.uploadBrandingLogo(file, onProgress)
    );

    expect(mockGetS3DirectUploadParams).toHaveBeenCalledWith({
      dest: 'branding_logos',
      name: 'logo.png',
      type: 'image/png',
      size: 1024,
    });
    expect(objectKey).toBe('uploads/branding_logos/test-logo.png');
    expect(xhrInstances).toHaveLength(1);
    expect(xhrInstances[0]?.open).toHaveBeenCalledWith(
      'PUT',
      'https://s3.example.com/media-bucket/uploads/branding_logos/test-logo.png'
    );
    expect(onProgress).toHaveBeenCalledWith(100);
  });
});
