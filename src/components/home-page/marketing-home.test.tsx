import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarketingHome } from './marketing-home';

describe('MarketingHome', () => {
  it('renders the "Read the API docs" button linking to /docs', () => {
    render(<MarketingHome />);
    const button = screen.getByRole('link', { name: /read the api docs/i });
    expect(button).toHaveAttribute('href', '/docs');
  });

  it('renders the footer "API docs" link pointing to /docs', () => {
    render(<MarketingHome />);
    const links = screen.getAllByRole('link');
    const apiDocsLink = links.find(
      (link) =>
        link.textContent?.includes('API docs') &&
        !link.textContent?.includes('Read')
    );
    expect(apiDocsLink).toHaveAttribute('href', '/docs');
  });

  it('renders the footer "Webhooks" link pointing to /docs/webhooks', () => {
    render(<MarketingHome />);
    // There might be multiple, get the footer one (not the main nav)
    const allWebhooksLinks = screen.getAllByRole('link', { name: /webhooks/i });
    const footerWebhooksLink = allWebhooksLinks.find(
      (link) => link.getAttribute('href') === '/docs/webhooks'
    );
    expect(footerWebhooksLink).toHaveAttribute('href', '/docs/webhooks');
  });

  it('renders the footer "Booking API" link pointing to /docs/reference', () => {
    render(<MarketingHome />);
    const bookingApiLink = screen.getByRole('link', { name: /booking api/i });
    expect(bookingApiLink).toHaveAttribute('href', '/docs/reference');
  });

  it('renders footer Status links pointing to the status page', () => {
    render(<MarketingHome />);
    const statusLinks = screen.getAllByRole('link', { name: /^status$/i });
    expect(statusLinks).toHaveLength(2);
    statusLinks.forEach((link) => {
      expect(link).toHaveAttribute(
        'href',
        'https://status.schedule.vintasoftware.com/'
      );
    });
  });
});
