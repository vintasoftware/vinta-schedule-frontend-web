/**
 * payment-provider-sdk.ts — the PRODUCTION `PaymentProviderSdk` factory.
 *
 * This is the only place that touches a real provider SDK. It injects the
 * provider's public `<script>` at runtime (never bundled — the plan says
 * load-not-bundle, avoiding a Stripe npm dependency + license surface) and
 * adapts `window.Stripe(...)` to the provider-agnostic `PaymentProviderSdk`
 * interface.
 *
 * `PaymentInstrumentField` takes this as its DEFAULT `createSdk` factory but
 * accepts an injected one, so tests and stories pass a fake and this module is
 * never exercised without a browser + network. The script URL is a stable
 * public endpoint, kept as a module constant rather than an env var (no
 * per-deployment configuration is needed; if a CSP-overridable URL is ever
 * required, that becomes an `add-env-var` change touching only that constant).
 *
 * The Stripe adapter mirrors the well-established Elements + `createToken` flow.
 *
 * Stripe is the only working provider (see the plan's Non-goals: completing a
 * MercadoPago adapter is explicitly out of scope). Any other resolved provider
 * — MercadoPago or an unrecognized value — gets `createUnsupportedProviderSdk`,
 * a safe no-op adapter: it never injects a script, never mounts anything, and
 * `tokenize()` returns a typed `unsupported_provider` error so the capture UI
 * can render a clean "not available" message instead of a card form that can
 * never tokenize.
 */

import type { PaymentProvider } from '@/client';
import {
  asPaymentToken,
  type PaymentInstrumentResult,
  type PaymentProviderSdk,
} from './payment-token';

/** A factory that builds the right `PaymentProviderSdk` for a resolved provider. */
export type PaymentProviderSdkFactory = (
  provider: PaymentProvider
) => PaymentProviderSdk;

// Stable public provider script endpoint. See module doc for why this is a
// constant and not an env var.
export const STRIPE_SDK_URL = 'https://js.stripe.com/v3/';

/**
 * Injects a `<script src>` once and resolves when it loads. Concurrent and
 * repeat calls for the same `src` share one injection and one load promise, so
 * re-mounting the field never double-injects the provider script.
 */
const scriptLoads = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = scriptLoads.get(src);
  if (existing) return existing;

  const load = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Cannot load a provider SDK outside the browser.'));
      return;
    }
    const prior = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    );
    if (prior && prior.dataset.loaded === 'true') {
      resolve();
      return;
    }
    const script = prior ?? document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    });
    script.addEventListener('error', () => {
      // Let a later mount retry rather than caching the failure forever.
      scriptLoads.delete(src);
      reject(new Error(`Failed to load provider SDK: ${src}`));
    });
    if (!prior) document.head.appendChild(script);
  });

  scriptLoads.set(src, load);
  return load;
}

// --- Stripe -------------------------------------------------------------------

interface StripeCardElement {
  mount(target: HTMLElement | string): void;
  unmount(): void;
}
interface StripeElements {
  create(type: 'card', options?: unknown): StripeCardElement;
}
interface StripeTokenResult {
  token?: { id: string };
  error?: { code?: string; message?: string };
}
interface StripeInstance {
  elements(): StripeElements;
  createToken(element: StripeCardElement): Promise<StripeTokenResult>;
}
type StripeConstructor = (publishableKey: string) => StripeInstance;

function createStripeSdk(publishableKey: string): PaymentProviderSdk {
  let card: StripeCardElement | null = null;
  let stripe: StripeInstance | null = null;

  return {
    async load() {
      await loadScript(STRIPE_SDK_URL);
      const ctor = (window as unknown as { Stripe?: StripeConstructor }).Stripe;
      if (!ctor)
        throw new Error('Stripe.js loaded but window.Stripe is absent.');
      stripe = ctor(publishableKey);
    },
    async mountCardElement(container: HTMLElement) {
      if (!stripe) throw new Error('Stripe SDK not loaded before mount.');
      card = stripe.elements().create('card');
      card.mount(container);
    },
    async tokenize(): Promise<PaymentInstrumentResult> {
      if (!stripe || !card) {
        return {
          status: 'error',
          reason: 'sdk_load_failed',
          message: 'The payment field is not ready yet.',
        };
      }
      const { token, error } = await stripe.createToken(card);
      if (error) {
        // Stripe validation errors for empty/partial cards carry an
        // `incomplete_*` code; everything else is a genuine failure.
        const incomplete = error.code?.startsWith('incomplete') ?? false;
        return {
          status: 'error',
          reason: incomplete ? 'incomplete' : 'tokenization_failed',
          message: error.message ?? 'We could not process this card.',
        };
      }
      if (!token) {
        return {
          status: 'error',
          reason: 'tokenization_failed',
          message: 'We could not process this card.',
        };
      }
      return { status: 'tokenized', token: asPaymentToken(token.id) };
    },
    unmount() {
      card?.unmount();
      card = null;
    },
  };
}

// --- Unsupported provider ------------------------------------------------------

/**
 * A safe "provider not supported" adapter for any resolved provider other than
 * Stripe (MercadoPago or an unrecognized value). It implements the same
 * `PaymentProviderSdk` shape as the working adapters so the capture UI can
 * treat it uniformly, but it never injects a script and never mounts anything
 * — `mount` and `unmount` are no-ops, and `tokenize()` always resolves to the
 * typed `unsupported_provider` error. See the module doc.
 */
function createUnsupportedProviderSdk(): PaymentProviderSdk {
  return {
    async load() {
      // No-op: no script to inject for an unsupported provider.
    },
    async mountCardElement() {
      // No-op: never mount a card field that can never tokenize.
    },
    async tokenize(): Promise<PaymentInstrumentResult> {
      return {
        status: 'error',
        reason: 'unsupported_provider',
        message: "Card payment isn't available for this payment provider.",
      };
    },
    unmount() {
      // No-op: nothing was ever mounted.
    },
  };
}

/**
 * The default production factory: picks the adapter for the resolved provider
 * and hands it the browser-safe credential from `GET /billing/payment-provider/`.
 * Stripe is the only working provider; any other resolved provider gets the
 * clean "not supported" outcome instead of throwing, so the capture UI can
 * render a message rather than crash.
 */
export const createProviderSdk: PaymentProviderSdkFactory = (provider) => {
  if (provider.provider === 'stripe') {
    if (!provider.stripe) {
      throw new Error('Stripe resolved but no publishable key was provided.');
    }
    return createStripeSdk(provider.stripe.publishable_key);
  }
  return createUnsupportedProviderSdk();
};
