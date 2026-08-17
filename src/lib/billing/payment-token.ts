/**
 * payment-token.ts — the provider-agnostic tokenization contract (Phase 1,
 * Data Model Changes → 3.3).
 *
 * `change-plan` and `add-ons` hand the API a `payment_token` minted client-side
 * by the deployment's resolved provider (Stripe.js today; any other resolved
 * provider is a clean "not supported" outcome — see `payment-provider-sdk.ts`).
 * This module fixes the ONE contract every provider outcome sits behind so the
 * purchase flows never branch on provider:
 *
 * - `PaymentToken` — an opaque, branded string. It is not interchangeable with a
 *   plain `string`, so a raw literal can't be passed where a minted token is
 *   required; the only way to obtain one is `asPaymentToken`, called by an SDK
 *   adapter after the provider returns it.
 * - `PaymentInstrumentResult` — the discriminated union `tokenize()` returns:
 *   a token, or a typed error the flow can branch on for messaging.
 * - `PaymentProviderSdk` — the minimal surface a provider SDK is adapted to
 *   (`load` + `mountCardElement` + `tokenize`), so a fake can be injected in
 *   tests and stories without touching the network or a real provider script.
 */

/** Opaque, branded payment token — see module doc. Mint via `asPaymentToken`. */
export type PaymentToken = string & { readonly __brand: 'PaymentToken' };

/** Brands a provider-returned token string as a `PaymentToken`. */
export function asPaymentToken(raw: string): PaymentToken {
  return raw as PaymentToken;
}

/**
 * Why tokenization did not yield a token:
 * - `unconfigured` — no provider is configured for this deployment (the
 *   `409` from `GET /billing/payment-provider/`), or its credentials are
 *   missing, so no card field was ever mounted.
 * - `unsupported_provider` — the resolved provider has no working adapter
 *   (today: anything other than Stripe). No card field was ever mounted.
 * - `sdk_load_failed` — the provider's JS SDK failed to load or its secure
 *   card element failed to mount.
 * - `incomplete` — the card element is mounted but the entered card data is
 *   incomplete/invalid; the user can correct it and retry.
 * - `tokenization_failed` — the provider rejected the tokenization request for
 *   any other reason.
 */
export type PaymentInstrumentErrorReason =
  | 'unconfigured'
  | 'unsupported_provider'
  | 'sdk_load_failed'
  | 'incomplete'
  | 'tokenization_failed';

/** The result of `PaymentInstrumentField.tokenize()` — a token or a typed error. */
export type PaymentInstrumentResult =
  | { status: 'tokenized'; token: PaymentToken }
  | { status: 'error'; reason: PaymentInstrumentErrorReason; message: string };

/**
 * The provider-agnostic SDK surface `PaymentInstrumentField` drives. The
 * production Stripe adapter (in `payment-provider-sdk.ts`) implements this by
 * injecting the Stripe.js script and wrapping its element + tokenization APIs;
 * an unsupported provider gets a no-op adapter of the same shape. Tests and
 * stories inject a fake implementing the same shape.
 */
export interface PaymentProviderSdk {
  /** Load/initialize the underlying provider SDK. Idempotent; may inject a script. */
  load(): Promise<void>;
  /** Mount the provider's secure card element (a provider iframe) into `container`. */
  mountCardElement(container: HTMLElement): Promise<void>;
  /** Tokenize the currently-entered card, returning a token or a typed error. */
  tokenize(): Promise<PaymentInstrumentResult>;
  /** Tear down the mounted element and any listeners. Optional for fakes. */
  unmount?(): void;
}
