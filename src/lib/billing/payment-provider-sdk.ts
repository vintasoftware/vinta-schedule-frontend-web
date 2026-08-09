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
 * The Stripe adapter mirrors the well-established Elements + `createToken` flow.
 * The MercadoPago Secure Fields adapter (`createCardToken`) is written to the
 * documented v2 API shape but has no repo precedent and no live test here.
 *
 * LIVE-VERIFICATION CHECKLIST (MercadoPago) — must be confirmed against a live
 * MercadoPago account before Phase 3/4 ship a real charge through this adapter.
 * The field names below are the documented MercadoPago.js v2 shape but are
 * UNVERIFIED here; do not treat them as confirmed:
 *   1. `fields.create('cardNumber' | 'expirationDate' | 'securityCode')` are the
 *      correct Secure Field types, and the SDK reads their values automatically
 *      at `createCardToken` time (i.e. they are NOT passed in the payload).
 *   2. `fields.createCardToken(payload)` requires, at minimum, the non-iframe
 *      inputs modelled by `MpCardTokenInputs`:
 *        - `cardholderName`       (string; name printed on the card)
 *        - `identificationType`   (string; e.g. 'CPF' — country-dependent)
 *        - `identificationNumber` (string; the document number)
 *      Confirm the exact key names, whether any are optional per country, and
 *      whether `cardholderName` can instead be a fourth Secure Field.
 *   3. The success shape is `{ id: string }` (the token id read below).
 * Until a real purchase flow (Phase 3/4) collects and threads those inputs, the
 * payload fields are blank and the call FAILS CLOSED — a missing/blank token
 * maps to `incomplete`, never a silent success.
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
  createCardToken(
    data: MpCardTokenInputs
  ): Promise<{ id?: string } | undefined>;
}
interface MercadoPagoInstance {
  fields: MpFields;
}
interface MercadoPagoConstructor {
  new (publicKey: string, options?: unknown): MercadoPagoInstance;
}

/**
 * The non-iframe inputs `fields.createCardToken` needs in addition to the Secure
 * Fields (card number, expiry, CVV) it reads automatically from the mounted
 * iframes. These key names are the documented MercadoPago.js v2 shape but are
 * TO-BE-VERIFIED — see the LIVE-VERIFICATION CHECKLIST in the module doc.
 */
interface MpCardTokenInputs {
  cardholderName: string;
  identificationType: string;
  identificationNumber: string;
}

// MercadoPago Secure Fields mount into elements addressed by id. Two fields on
// one page would collide on a fixed global id (getElementById resolves the first
// match), so every adapter instance gets a unique id suffix from this counter.
let mpInstanceCounter = 0;

const MP_FIELD_TYPES = [
  'cardNumber',
  'expirationDate',
  'securityCode',
] as const;

function createMercadoPagoSdk(publicKey: string): PaymentProviderSdk {
  let mp: MercadoPagoInstance | null = null;
  const mounted: MpField[] = [];
  // Track the mount-target nodes this adapter appended so `unmount` can remove
  // them — otherwise an effect re-run (provider/createSdk change) orphans the
  // divs and leaves duplicate ids behind.
  const targets: HTMLElement[] = [];
  const instanceId = ++mpInstanceCounter;

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
      for (const type of MP_FIELD_TYPES) {
        const id = `mp-${type}-${instanceId}`;
        const target = document.createElement('div');
        target.id = id;
        container.appendChild(target);
        targets.push(target);
        mounted.push(mp.fields.create(type).mount(id));
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
        // The Secure Fields (card number, expiry, CVV) are read by the SDK from
        // the mounted iframes; `createCardToken` additionally needs the explicit
        // non-iframe inputs below. A real purchase flow (Phase 3/4) must collect
        // and thread these; until then they are blank and the call FAILS CLOSED
        // (blank/missing token → `incomplete`). See the module LIVE-VERIFICATION
        // CHECKLIST — the key names are UNVERIFIED against a live MercadoPago
        // account.
        const inputs: MpCardTokenInputs = {
          cardholderName: '',
          identificationType: '',
          identificationNumber: '',
        };
        const token = await mp.fields.createCardToken(inputs);
        const tokenId = token?.id?.trim();
        if (!tokenId) {
          return {
            status: 'error',
            reason: 'incomplete',
            message: 'Please complete the card details.',
          };
        }
        return { status: 'tokenized', token: asPaymentToken(tokenId) };
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
      // Remove the divs we appended so an effect re-run leaves no orphan nodes
      // or duplicate ids in the container.
      for (const target of targets) target.remove();
      targets.length = 0;
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
