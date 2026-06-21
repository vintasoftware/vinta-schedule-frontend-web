// Empty mock for `server-only` in the Vitest/jsdom environment.
// The real `server-only` package throws when imported outside a server context.
// In tests, we alias this to a no-op so server-side modules can be tested
// without triggering the guard. The build-time guard still works in Next.js.
export {};
