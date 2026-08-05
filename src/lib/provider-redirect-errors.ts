const DEFAULT_MESSAGE =
  'Could not start social sign-in. Please try again.';

/**
 * Turn a redirect-json error payload into a user-facing message.
 * The custom OAuth endpoint returns Django field errors
 * (`{ callback_url: ["Invalid URL."] }`), not the allauth `{ errors: [...] }`
 * shape used elsewhere.
 */
export function formatProviderRedirectError(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return DEFAULT_MESSAGE;
  }

  const record = body as Record<string, unknown>;

  for (const [field, messages] of Object.entries(record)) {
    if (field === 'status' || field === 'meta' || field === 'data') {
      continue;
    }
    if (Array.isArray(messages) && messages.length > 0) {
      const first = messages[0];
      if (typeof first === 'string') {
        return first;
      }
    }
  }

  if (Array.isArray(record.errors) && record.errors.length > 0) {
    const first = record.errors[0];
    if (
      first &&
      typeof first === 'object' &&
      'message' in first &&
      typeof first.message === 'string'
    ) {
      return first.message;
    }
  }

  return DEFAULT_MESSAGE;
}
