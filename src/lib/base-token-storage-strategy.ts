export interface TokenStorageStrategy {
  getAccessToken(): Promise<string | null>;
  setAccessToken(token: string): Promise<void>;
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  /** Clear access + refresh tokens (e.g. refresh token invalid/expired → force re-login). */
  removeTokens(): Promise<void>;
  shouldIntercept(): boolean;
}
