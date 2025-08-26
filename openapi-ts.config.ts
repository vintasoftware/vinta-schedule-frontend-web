import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './schema.yml',
  output: 'src/client',
  plugins: [
    {
      name: '@hey-api/client-fetch',
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
    },
    {
      name: '@tanstack/react-query',
    },
  ],
});
