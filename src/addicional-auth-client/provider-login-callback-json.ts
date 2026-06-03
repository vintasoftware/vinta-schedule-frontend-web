import {
  GetAuthByClientV1AuthSessionError,
  GetAuthByClientV1AuthSessionResponse,
} from '@/auth-client';
import { client } from '@/auth-client/client.gen';

export type ProviderLoginCallbackParams = {
  provider: string;
  queryParams: Record<string, unknown>;
  sessionToken?: string;
};

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

export async function postAppV1AuthProviderCallbackJson({
  provider,
  queryParams,
  sessionToken,
}: ProviderLoginCallbackParams) {
  try {
    return (await fetch(
      `${client.getConfig().baseUrl}/auth/app/v1/auth/provider/callback-json/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken ? sessionToken : '',
        },
        body: JSON.stringify({
          ...queryParams,
          provider_id: provider,
        }),
        redirect: 'manual',
      }
    )) as GenericFetchResponse<GetAuthByClientV1AuthSessionResponse>;
  } catch (error) {
    throw error as GetAuthByClientV1AuthSessionError;
  }
}
