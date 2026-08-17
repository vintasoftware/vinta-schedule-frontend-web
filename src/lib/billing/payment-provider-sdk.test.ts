/**
 * payment-provider-sdk tests — the PRODUCTION adapters.
 *
 * Every `PaymentInstrumentField` test injects a fake SDK, so the real
 * `createProviderSdk` / `createStripeSdk` adapters had no coverage. These
 * drive them directly against a FAKE `window.Stripe` global — never a real
 * provider script or network. The provider `<script>` is pre-seeded as
 * already-loaded so `loadScript` resolves without a real injection.
 *
 * Pins:
 * - credential selection for the Stripe adapter (right key handed to the SDK);
 * - the Stripe error→reason mapping (`incomplete_*` → `incomplete`, else
 *   `tokenization_failed`) and token minting;
 * - the throw when a resolved Stripe provider is missing its credential;
 * - the factory returns the unsupported-provider adapter for MercadoPago and
 *   for an unrecognized provider, and that adapter's `mount()`/`unmount()`
 *   are safe no-ops and its `tokenize()` returns the typed
 *   `unsupported_provider` error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { PaymentProvider } from '@/client';
import { createProviderSdk, STRIPE_SDK_URL } from './payment-provider-sdk';

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

// A provider value the resolved-provider union doesn't (yet) declare — the
// factory must degrade to the unsupported adapter rather than throw.
const UNKNOWN_PROVIDER = {
  provider: 'unknown_provider',
  stripe: null,
  mercadopago: null,
} as unknown as PaymentProvider;

type WindowWithProviders = typeof window & {
  Stripe?: unknown;
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

beforeEach(() => {
  seedLoadedScript(STRIPE_SDK_URL);
});

afterEach(() => {
  delete (window as WindowWithProviders).Stripe;
  vi.clearAllMocks();
});

describe('createProviderSdk', () => {
  it('throws when the Stripe credential is missing', () => {
    expect(() =>
      createProviderSdk({ provider: 'stripe', stripe: null, mercadopago: null })
    ).toThrow(/publishable key/i);
  });

  it('hands the publishable key to Stripe for a stripe provider', async () => {
    const fake = makeFakeStripe();
    (window as WindowWithProviders).Stripe = fake.ctor;

    const sdk = createProviderSdk(STRIPE_PROVIDER);
    await sdk.load();

    expect(fake.ctor).toHaveBeenCalledWith('pk_test_123');
  });

  it('returns the unsupported-provider adapter for a mercadopago provider (no throw)', async () => {
    const scriptCountBefore = document.querySelectorAll('script').length;
    const sdk = createProviderSdk(MERCADOPAGO_PROVIDER);

    // Never injects a script, never mounts anything, and tokenize() is safe.
    await expect(sdk.load()).resolves.toBeUndefined();
    const container = document.createElement('div');
    await expect(sdk.mountCardElement(container)).resolves.toBeUndefined();
    expect(container.children).toHaveLength(0);
    expect(document.querySelectorAll('script')).toHaveLength(scriptCountBefore);

    expect(await sdk.tokenize()).toEqual({
      status: 'error',
      reason: 'unsupported_provider',
      message: expect.any(String),
    });

    expect(() => sdk.unmount?.()).not.toThrow();
  });

  it('returns the unsupported-provider adapter for an unrecognized provider (no throw)', async () => {
    const sdk = createProviderSdk(UNKNOWN_PROVIDER);

    await expect(sdk.load()).resolves.toBeUndefined();
    expect(await sdk.tokenize()).toMatchObject({
      status: 'error',
      reason: 'unsupported_provider',
    });
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
