// Ambient module declaration for importing `.md` files as plain strings
// (e.g. docs page content), instead of storing markdown as escaped TS
// template literals. The `?raw` suffix is Vite/Vitest's native way to
// resolve this; Turbopack additionally needs the `turbopackLoader`/
// `turbopackAs` import attributes at the call site (Turbopack has no
// built-in module type for `.md`). Neither bundler needs this file — they
// resolve the import at build time — but tsc does not know the `?raw`
// suffix without a declaration.
declare module '*.md?raw' {
  const content: string;
  export default content;
}
