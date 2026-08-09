/**
 * payment-provider-sdk tests — the PRODUCTION adapters.
 *
 * Every `PaymentInstrumentField` test injects a fake SDK, so the real
 * `createProviderSdk` / `createStripeSdk` / `createMercadoPagoSdk` adapters had
 * no coverage. These drive them directly against a FAKE `window.Stripe` and a
 * fake `window.MercadoPago` global — never a real provider script or network.
 * The provider `<script>` is pre-seeded as already-loaded so `loadScript`
 * resolves without a real injection.
 *
 * Pins:
 * - credential selection per provider (right key handed to the right SDK);
 * - the Stripe error→reason mapping (`incomplete_*` → `incomplete`, else
 *   `tokenization_failed`) and token minting;
 * - the throw when a resolved provider is missing its credential;
 * - the MercadoPago per-instance field ids + node cleanup, and its fail-closed
 *   `incomplete` on a missing/blank token.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { PaymentProvider } from '@/client';
import {
  createProviderSdk,
  STRIPE_SDK_URL,
  MERCADOPAGO_SDK_URL,
} from './payment-provider-sdk';

const STRIPE_PROVIDER: PaymentProvider = {
  provider: 'stripe',
  stripe: { publishable_key: 'pk_test_123' },
  mercadopago: null,
};

const MERCADOPAGO_PROVIDER: PaymentProvider = {
  provider: 'mercadopago',
  stripe: null,
  mercadopago: { public_key: 'MP_PUB_123' },
};

type WindowWithProviders = typeof window & {
  Stripe?: unknown;
  MercadoPago?: unknown;
};

/**
 * Pre-seed a `<script src>` marked already-loaded so `loadScript` resolves via
 * its `dataset.loaded === 'true'` fast path — jsdom never fires a real load
 * event for an injected script.
 */
function seedLoadedScript(src: string) {
  document
    .querySelectorAll(`script[src="${src}"]`)
    .forEach((node) => node.remove());
  const script = document.createElement('script');
  script.src = src;
  script.dataset.loaded = 'true';
  document.head.appendChild(script);
}

function makeFakeStripe() {
  const card = { mount: vi.fn(), unmount: vi.fn() };
  const create = vi.fn(() => card);
  const createToken = vi.fn();
  const elements = vi.fn(() => ({ create }));
  const ctor = vi.fn(() => ({ elements, createToken }));
  return { ctor, card, create, createToken };
}

function makeMpField() {
  const field: { mount: ReturnType<typeof vi.fn>; unmount: () => void } = {
    mount: vi.fn(() => field),
    unmount: vi.fn(),
  };
  return field;
}

function makeFakeMp() {
  const createCardToken = vi.fn();
  const create = vi.fn(() => makeMpField());
  // A real function (not an arrow) so the adapter's `new ctor(publicKey)` works.
  const ctor = vi.fn(function () {
    return { fields: { create, createCardToken } };
  });
  return { ctor, create, createCardToken };
}

beforeEach(() => {
  seedLoadedScript(STRIPE_SDK_URL);
  seedLoadedScript(MERCADOPAGO_SDK_URL);
});

afterEach(() => {
  delete (window as WindowWithProviders).Stripe;
  delete (window as WindowWithProviders).MercadoPago;
  vi.clearAllMocks();
});

describe('createProviderSdk credential selection', () => {
  it('throws when the Stripe credential is missing', () => {
    expect(() =>
      createProviderSdk({ provider: 'stripe', stripe: null, mercadopago: null })
    ).toThrow(/publishable key/i);
  });

  it('throws when the MercadoPago credential is missing', () => {
    expect(() =>
      createProviderSdk({
        provider: 'mercadopago',
        stripe: null,
        mercadopago: null,
      })
    ).toThrow(/public key/i);
  });

  it('hands the publishable key to Stripe for a stripe provider', async () => {
    const fake = makeFakeStripe();
    (window as WindowWithProviders).Stripe = fake.ctor;

    const sdk = createProviderSdk(STRIPE_PROVIDER);
    await sdk.load();

    expect(fake.ctor).toHaveBeenCalledWith('pk_test_123');
  });

  it('hands the public key to MercadoPago for a mercadopago provider', async () => {
    const fake = makeFakeMp();
    (window as WindowWithProviders).MercadoPago = fake.ctor;

    const sdk = createProviderSdk(MERCADOPAGO_PROVIDER);
    await sdk.load();

    expect(fake.ctor).toHaveBeenCalledWith('MP_PUB_123');
  });
});

describe('createStripeSdk', () => {
  it('throws if the script loads but window.Stripe is absent', async () => {
    const sdk = createProviderSdk(STRIPE_PROVIDER);
    await expect(sdk.load()).rejects.toThrow(/window\.Stripe is absent/);
  });

  it('mints a token from a successful createToken', async () => {
    const fake = makeFakeStripe();
    fake.createToken.mockResolvedValue({ token: { id: 'tok_live' } });
    (window as WindowWithProviders).Stripe = fake.ctor;

    const sdk = createProviderSdk(STRIPE_PROVIDER);
    await sdk.load();
    await sdk.mountCardElement(document.createElement('div'));

    expect(await sdk.tokenize()).toEqual({
      status: 'tokenized',
      token: 'tok_live',
    });
  });

  it('maps an incomplete_* error to reason "incomplete"', async () => {
    const fake = makeFakeStripe();
    fake.createToken.mockResolvedValue({
      error: {
        code: 'incomplete_number',
        message: 'Card number is incomplete.',
      },
    });
    (window as WindowWithProviders).Stripe = fake.ctor;

    const sdk = createProviderSdk(STRIPE_PROVIDER);
    await sdk.load();
    await sdk.mountCardElement(document.createElement('div'));

    expect(await sdk.tokenize()).toMatchObject({
      status: 'error',
      reason: 'incomplete',
      message: 'Card number is incomplete.',
    });
  });

  it('maps any other error to reason "tokenization_failed"', async () => {
    const fake = makeFakeStripe();
    fake.createToken.mockResolvedValue({
      error: { code: 'card_declined', message: 'Your card was declined.' },
    });
    (window as WindowWithProviders).Stripe = fake.ctor;

    const sdk = createProviderSdk(STRIPE_PROVIDER);
    await sdk.load();
    await sdk.mountCardElement(document.createElement('div'));

    expect(await sdk.tokenize()).toMatchObject({
      status: 'error',
      reason: 'tokenization_failed',
    });
  });

  it('fails closed to "tokenization_failed" when neither token nor error is returned', async () => {
    const fake = makeFakeStripe();
    fake.createToken.mockResolvedValue({});
    (window as WindowWithProviders).Stripe = fake.ctor;

    const sdk = createProviderSdk(STRIPE_PROVIDER);
    await sdk.load();
    await sdk.mountCardElement(document.createElement('div'));

    expect(await sdk.tokenize()).toMatchObject({
      status: 'error',
      reason: 'tokenization_failed',
    });
  });
});

describe('createMercadoPagoSdk', () => {
  it('mounts three secure-field targets and removes them on unmount', async () => {
    const fake = makeFakeMp();
    (window as WindowWithProviders).MercadoPago = fake.ctor;

    const sdk = createProviderSdk(MERCADOPAGO_PROVIDER);
    await sdk.load();
    const container = document.createElement('div');
    await sdk.mountCardElement(container);

    expect(container.children).toHaveLength(3);

    sdk.unmount?.();
    // No orphan nodes / duplicate ids left behind after teardown.
    expect(container.children).toHaveLength(0);
  });

  it('gives each adapter instance unique field ids so two fields never collide', async () => {
    const fake = makeFakeMp();
    (window as WindowWithProviders).MercadoPago = fake.ctor;

    const first = createProviderSdk(MERCADOPAGO_PROVIDER);
    const second = createProviderSdk(MERCADOPAGO_PROVIDER);
    await first.load();
    await second.load();

    const firstContainer = document.createElement('div');
    const secondContainer = document.createElement('div');
    await first.mountCardElement(firstContainer);
    await second.mountCardElement(secondContainer);

    const firstIds = Array.from(firstContainer.children).map((el) => el.id);
    const secondIds = Array.from(secondContainer.children).map((el) => el.id);

    expect(firstIds).toHaveLength(3);
    expect(secondIds).toHaveLength(3);
    // All six ids distinct — no global collision.
    expect(new Set([...firstIds, ...secondIds]).size).toBe(6);
  });

  it('mints a token from a successful createCardToken', async () => {
    const fake = makeFakeMp();
    fake.createCardToken.mockResolvedValue({ id: 'mp_tok' });
    (window as WindowWithProviders).MercadoPago = fake.ctor;

    const sdk = createProviderSdk(MERCADOPAGO_PROVIDER);
    await sdk.load();
    await sdk.mountCardElement(document.createElement('div'));

    expect(await sdk.tokenize()).toEqual({
      status: 'tokenized',
      token: 'mp_tok',
    });
  });

  it('fails closed to "incomplete" on a missing token', async () => {
    const fake = makeFakeMp();
    fake.createCardToken.mockResolvedValue(undefined);
    (window as WindowWithProviders).MercadoPago = fake.ctor;

    const sdk = createProviderSdk(MERCADOPAGO_PROVIDER);
    await sdk.load();
    await sdk.mountCardElement(document.createElement('div'));

    expect(await sdk.tokenize()).toMatchObject({
      status: 'error',
      reason: 'incomplete',
    });
  });

  it('fails closed to "incomplete" on a blank token id', async () => {
    const fake = makeFakeMp();
    fake.createCardToken.mockResolvedValue({ id: '   ' });
    (window as WindowWithProviders).MercadoPago = fake.ctor;

    const sdk = createProviderSdk(MERCADOPAGO_PROVIDER);
    await sdk.load();
    await sdk.mountCardElement(document.createElement('div'));

    expect(await sdk.tokenize()).toMatchObject({
      status: 'error',
      reason: 'incomplete',
    });
  });

  it('maps a thrown createCardToken to "tokenization_failed"', async () => {
    const fake = makeFakeMp();
    fake.createCardToken.mockRejectedValue(new Error('mp boom'));
    (window as WindowWithProviders).MercadoPago = fake.ctor;

    const sdk = createProviderSdk(MERCADOPAGO_PROVIDER);
    await sdk.load();
    await sdk.mountCardElement(document.createElement('div'));

    expect(await sdk.tokenize()).toMatchObject({
      status: 'error',
      reason: 'tokenization_failed',
      message: 'mp boom',
    });
  });
});
