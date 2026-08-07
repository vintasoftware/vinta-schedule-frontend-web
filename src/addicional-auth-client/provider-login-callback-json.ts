// TODO: replace with generated client once backend adds these to the OpenAPI spec
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

/**
 * The headless callback response, plus `destination` — the backend-resolved
 * post-auth landing URL (organization-auth-branding handoff, "Resolved
 * post-auth destination"). `schema-auth.yml` doesn't expose it yet, so it's
 * hand-extended here until the allauth OpenAPI schema catches up.
 */
export type ProviderCallbackJsonResponse =
  GetAuthByClientV1AuthSessionResponse & {
    destination?: string;
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
    )) as GenericFetchResponse<ProviderCallbackJsonResponse>;
  } catch (error) {
    throw error as GetAuthByClientV1AuthSessionError;
  }
}
