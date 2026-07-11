import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-themes',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
  // When deploying to GitHub Pages the site lives under a repo subpath
  // (e.g. /vinta-schedule-frontend-web/design-system/), so the built assets
  // must be referenced relative to that base. STORYBOOK_BASE_PATH is set by
  // the deploy workflow; locally it is unset and the base stays at '/'.
  async viteFinal(config) {
    const basePath = process.env.STORYBOOK_BASE_PATH;
    if (basePath) {
      config.base = basePath;
    }
    return config;
  },
};

export default config;
