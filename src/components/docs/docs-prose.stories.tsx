import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { DocsProse } from './docs-prose';

const meta = {
  title: 'Docs/DocsProse',
  component: DocsProse,
  tags: ['autodocs'],
} satisfies Meta<typeof DocsProse>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithChildren: Story = {
  render: () => (
    <DocsProse>
      <h1>Getting Started</h1>
      <p>
        This is a guide to help you get started with our platform. It covers the
        basics and common patterns.
      </p>
      <h2>Installation</h2>
      <p>To install the package, run the following command in your terminal:</p>
      <ul>
        <li>First, ensure you have Node.js installed</li>
        <li>Then, install the package using npm or yarn</li>
        <li>Finally, import the components into your project</li>
      </ul>
      <h2>Usage</h2>
      <p>
        Once installed, you can start using the components in your application.
      </p>
    </DocsProse>
  ),
};

export const WithHtml: Story = {
  render: () => (
    <DocsProse
      html={`
        <h1>API Reference</h1>
        <p>This is the API reference documentation generated from the schema.</p>
        <h2>Endpoints</h2>
        <p>Browse available endpoints and their parameters:</p>
        <ul>
          <li><a href="#get-users">GET /users</a></li>
          <li><a href="#post-users">POST /users</a></li>
          <li><a href="#get-user-id">GET /users/:id</a></li>
        </ul>
        <h2>Response Format</h2>
        <p>All responses are returned as JSON objects.</p>
        <ol>
          <li>Check the status code</li>
          <li>Parse the response body</li>
          <li>Handle errors appropriately</li>
        </ol>
      `.trim()}
    />
  ),
};
