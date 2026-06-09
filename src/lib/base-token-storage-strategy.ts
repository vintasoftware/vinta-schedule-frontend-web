export interface TokenStorageStrategy {
  getAccessToken(): Promise<string | null>;
  setAccessToken(token: string): Promise<void>;
  /** Exchange the stored refresh token for a new access token. Returns the new access token, or null on failure. */
  refreshTokens(): Promise<string | null>;
  /** Clear access + refresh tokens (e.g. refresh token invalid/expired → force re-login). */
  removeTokens(): Promise<void>;
  shouldIntercept(): boolean;
}
