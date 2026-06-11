import { Login } from '@/auth-client';
import { postAuthByClientV1AuthLoginMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';
import { storeAuthTokens } from '@/lib/auth-server-actions';
import { setMemoryAccessToken } from '@/lib/token-storage-strategy.client';

/**
 * Optional device metadata, captured by the backend per refresh token and carried
 * across rotations. Sent as headers on login. `User-Agent` is sent by the browser.
 */
export interface DeviceMetadata {
  deviceName?: string;
  deviceId?: string;
  operatingSystem?: string;
  latitude?: string;
  longitude?: string;
}

function deviceHeaders(device?: DeviceMetadata): Record<string, string> {
  if (!device) return {};
  const headers: Record<string, string> = {};
  if (device.deviceName) headers['X-Device-Name'] = device.deviceName;
  if (device.deviceId) headers['X-Device-Id'] = device.deviceId;
  if (device.operatingSystem)
    headers['X-Operating-System'] = device.operatingSystem;
  if (device.latitude) headers['X-Device-Location-Latitude'] = device.latitude;
  if (device.longitude)
    headers['X-Device-Location-Longitude'] = device.longitude;
  return headers;
}

export function useLogin() {
  const loginMutation = useMutation({
    ...postAuthByClientV1AuthLoginMutation(),
  });

  const login = async (data: Login, device?: DeviceMetadata) => {
    const loginData = await loginMutation.mutateAsync({
      path: {
        client: 'app',
      },
      headers: deviceHeaders(device),
      body: data,
    });

    // native headless `app` flow: meta carries three separate tokens.
    // - access_token  → JWT, sent as `Authorization: Bearer` to the app API
    // - session_token → sent as `X-Session-Token` to allauth endpoints
    // - refresh_token → single-use rotating token (not declared in schema; patched in types)
    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      session_token: sessionToken,
    } = loginData.meta;

    if (loginData.data?.user?.id) {
      localStorage.setItem('uid', String(loginData.data.user.id));
    }
    // Access token lives in memory only. Refresh token is stored as an
    // httpOnly cookie via the server action — JS never persists it.
    if (accessToken) setMemoryAccessToken(accessToken);
    if (accessToken && refreshToken) {
      await storeAuthTokens(accessToken, refreshToken);
    }
    if (sessionToken) {
      localStorage.setItem('sessionToken', sessionToken);
    } else {
      localStorage.removeItem('sessionToken');
    }

    return loginData;
  };

  return {
    login,
    loginMutation,
  };
}
