// `graphiql/setup-workers/webpack` ships an empty side-effect declaration (it
// only registers `globalThis.MonacoEnvironment` for Monaco's web workers), which
// tsc rejects as "not a module" when dynamically imported. Declaring it as a
// side-effect module lets the worker-setup import in graphql-explorer.tsx
// typecheck. See the dynamic import there for why the setup is loaded at all.
declare module 'graphiql/setup-workers/webpack';
