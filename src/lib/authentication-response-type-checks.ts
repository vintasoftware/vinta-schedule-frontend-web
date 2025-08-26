import { AuthenticationResponse, AuthenticatedResponse, SessionGoneResponse } from '@/auth-client';

export function isAuthenticationResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any
): response is AuthenticationResponse {
  return (
    response &&
    response.data &&
    Array.isArray(response.data.flows) &&
    response.status === 401 &&
    response.meta
  );
}

export function isAuthenticatedResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any
): response is AuthenticatedResponse {
  return (
    response &&
    response.data &&
    response.data.user &&
    response.status === 200 &&
    response.meta
  );
}

export function isInvalidSessionResponse(response: unknown): response is SessionGoneResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'status' in response &&
    'data' in response &&
    response.status === 410
  );
}
