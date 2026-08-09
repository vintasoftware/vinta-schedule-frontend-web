/**
 * payment-provider-sdk.ts — the PRODUCTION `PaymentProviderSdk` factory.
 *
 * This is the only place that touches a real provider SDK. It injects the
 * provider's public `<script>` at runtime (never bundled — the plan says
 * load-not-bundle, avoiding a Stripe/MercadoPago npm dependency + license
 * surface) and adapts `window.Stripe(...)` / `new window.MercadoPago(...)` to
 * the provider-agnostic `PaymentProviderSdk` interface.
 *
 * `PaymentInstrumentField` takes this as its DEFAULT `createSdk` factory but
 * accepts an injected one, so tests and stories pass a fake and this module is
 * never exercised without a browser + network. The two script URLs are stable
 * public endpoints, kept as module constants rather than env vars (no
 * per-deployment configuration is needed; if a CSP-overridable URL is ever
 * required, that becomes an `add-env-var` change touching only these two
 * constants).
 *
 * NOTE FOR REVIEW: the Stripe adapter mirrors the well-established
 * Elements + `createToken` flow. The MercadoPago Secure Fields adapter
 * (`createCardToken`) is written to the documented v2 API shape but has no
 * repo precedent and no live test here; its exact `createCardToken` payload
 * must be verified against a live MercadoPago integration before Phase 3/4
 * ship a real charge through it.
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

// Stable public provider script endpoints. See module doc for why these are
// constants and not env vars.
export const STRIPE_SDK_URL = 'https://js.stripe.com/v3/';
export const MERCADOPAGO_SDK_URL = 'https://sdk.mercadopago.com/js/v2';

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

// --- MercadoPago --------------------------------------------------------------

interface MpField {
  mount(id: string): MpField;
  unmount(): void;
}
interface MpFields {
  create(
    type: 'cardNumber' | 'expirationDate' | 'securityCode',
    options?: unknown
  ): MpField;
  createCardToken(data: unknown): Promise<{ id?: string } | undefined>;
}
interface MercadoPagoInstance {
  fields: MpFields;
}
interface MercadoPagoConstructor {
  new (publicKey: string, options?: unknown): MercadoPagoInstance;
}

// MercadoPago Secure Fields mount into elements addressed by id, so the adapter
// builds three child mount targets inside the single container the contract
// hands it — keeping the multi-field provider behind the one-element interface.
const MP_FIELD_IDS = {
  cardNumber: 'mp-card-number',
  expirationDate: 'mp-expiration-date',
  securityCode: 'mp-security-code',
} as const;

function createMercadoPagoSdk(publicKey: string): PaymentProviderSdk {
  let mp: MercadoPagoInstance | null = null;
  const mounted: MpField[] = [];

  return {
    async load() {
      await loadScript(MERCADOPAGO_SDK_URL);
      const ctor = (
        window as unknown as { MercadoPago?: MercadoPagoConstructor }
      ).MercadoPago;
      if (!ctor) {
        throw new Error(
          'MercadoPago.js loaded but window.MercadoPago is absent.'
        );
      }
      mp = new ctor(publicKey);
    },
    async mountCardElement(container: HTMLElement) {
      if (!mp) throw new Error('MercadoPago SDK not loaded before mount.');
      for (const [type, id] of Object.entries(MP_FIELD_IDS)) {
        const target = document.createElement('div');
        target.id = id;
        container.appendChild(target);
        mounted.push(
          mp.fields.create(type as keyof typeof MP_FIELD_IDS).mount(id)
        );
      }
    },
    async tokenize(): Promise<PaymentInstrumentResult> {
      if (!mp) {
        return {
          status: 'error',
          reason: 'sdk_load_failed',
          message: 'The payment field is not ready yet.',
        };
      }
      try {
        // Payload shape must be verified against a live MercadoPago
        // integration (see module NOTE FOR REVIEW).
        const token = await mp.fields.createCardToken({});
        if (!token?.id) {
          return {
            status: 'error',
            reason: 'incomplete',
            message: 'Please complete the card details.',
          };
        }
        return { status: 'tokenized', token: asPaymentToken(token.id) };
      } catch (error) {
        return {
          status: 'error',
          reason: 'tokenization_failed',
          message:
            error instanceof Error
              ? error.message
              : 'We could not process this card.',
        };
      }
    },
    unmount() {
      for (const field of mounted) field.unmount();
      mounted.length = 0;
    },
  };
}

/**
 * The default production factory: picks the adapter for the resolved provider
 * and hands it the browser-safe credential from `GET /billing/payment-provider/`.
 */
export const createProviderSdk: PaymentProviderSdkFactory = (provider) => {
  if (provider.provider === 'stripe') {
    if (!provider.stripe) {
      throw new Error('Stripe resolved but no publishable key was provided.');
    }
    return createStripeSdk(provider.stripe.publishable_key);
  }
  if (!provider.mercadopago) {
    throw new Error('MercadoPago resolved but no public key was provided.');
  }
  return createMercadoPagoSdk(provider.mercadopago.public_key);
};
