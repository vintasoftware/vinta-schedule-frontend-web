import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    // Generated API clients + built Storybook output — not linted.
    ignores: ['src/client', 'src/auth-client', 'storybook-static'],
  },
  {
    // The React Compiler lint rules (react-hooks v6) shipped with
    // eslint-config-next 16 flag pre-existing, intentional patterns
    // (SSR-safe localStorage-in-effect reads, document.cookie writes in
    // event handlers). Keep them visible as warnings rather than blocking.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  {
    // Tailwind config loads plugins via require(), the idiomatic pattern.
    files: ['tailwind.config.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];

export default eslintConfig;
