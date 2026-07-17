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
    const webhooksLink = screen.getByRole('link', { name: /webhooks/i });
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

  it('keeps placeholder links (SDKs) pointing to #', () => {
    render(<MarketingHome />);
    const links = screen.getAllByRole('link');
    const sdksLink = links.find((link) => link.textContent?.trim() === 'SDKs');
    expect(sdksLink).toHaveAttribute('href', '#');
  });

  it('keeps placeholder links (Status in Developers) pointing to #', () => {
    render(<MarketingHome />);
    const links = screen.getAllByRole('link');
    // Filter for Status links (there are two: one in Developers, one in Trust)
    const statusLinks = links.filter(
      (link) => link.textContent?.trim() === 'Status'
    );
    // All Status links should point to #
    statusLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '#');
    });
  });

  it('keeps placeholder links (Changelog) pointing to #', () => {
    render(<MarketingHome />);
    const links = screen.getAllByRole('link');
    const changelogLink = links.find(
      (link) => link.textContent?.trim() === 'Changelog'
    );
    expect(changelogLink).toHaveAttribute('href', '#');
  });
});
