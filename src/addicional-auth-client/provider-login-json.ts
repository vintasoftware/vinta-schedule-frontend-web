import { client } from '@/auth-client/client.gen';

export type ProviderLoginRedirectParams = {
  provider: string;
  callbackUrl: string;
  process: string;
};

export type ProviderLoginRedirectResponse = {
  redirect_url: string;
  session_token: string;
}

type GenericFetchResponse<T> = {
  data?: T;
  status: number;
  statusText: string;
  headers: Headers;
  ok: boolean;
  redirected: boolean;
  url: string;
  text: () => Promise<string>;
  json: () => Promise<T>;
  blob: () => Promise<Blob>;
  arrayBuffer: () => Promise<ArrayBuffer>;
  formData: () => Promise<FormData>;
  clone: () => GenericFetchResponse<T>;
  error?: Error;
  type?: string;
  bodyUsed?: boolean;
  body?: ReadableStream<Uint8Array> | null;
};

export async function postAppV1AuthProviderRedirectJson({ provider, callbackUrl, process }: ProviderLoginRedirectParams): Promise<GenericFetchResponse<ProviderLoginRedirectResponse>> {
  return fetch(
    `${client.getConfig().baseUrl}/auth/app/v1/auth/provider/redirect-json/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        callback_url: callbackUrl,
        process,
      }),
    }
  );
}
