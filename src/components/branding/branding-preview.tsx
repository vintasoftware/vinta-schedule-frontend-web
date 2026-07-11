import * as React from 'react';
import {
  Stack,
  VStack,
  Heading,
  Text,
} from 'vinta-schedule-design-system/layout';

// ---------------------------------------------------------------------------
// BrandingPreview — a self-contained mock of the auth interstitial card,
// driven purely by form values. Intentionally avoids importing branding-server
// or branding-shared (those live on a separate branch). Inlines the preview
// logic so this feature is fully self-contained.
// ---------------------------------------------------------------------------

export interface BrandingPreviewProps {
  appName: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * Renders a stylised mock of the authentication sign-in card using the
 * provided branding values. The primary color is used for the header strip and
 * button background; secondary color for the button text. Falls back to token
 * colors when fields are empty.
 *
 * This component is intentionally presentational and carries no data hooks.
 */
export function BrandingPreview({
  appName,
  logoUrl,
  primaryColor,
  secondaryColor,
}: BrandingPreviewProps) {
  // Use the provided color or fall back to a CSS variable (rendered as a string
  // so Tailwind doesn't need to know the value at build time).
  const bgStyle: React.CSSProperties = primaryColor
    ? { backgroundColor: primaryColor }
    : {};
  const btnStyle: React.CSSProperties = {
    ...(primaryColor ? { backgroundColor: primaryColor } : {}),
    ...(secondaryColor ? { color: secondaryColor } : {}),
  };

  return (
    <Stack gap={0} className='w-full overflow-hidden rounded-md'>
      {/* Header strip */}
      <div
        className='flex items-center gap-2 px-4 py-3'
        style={primaryColor ? bgStyle : { backgroundColor: 'var(--primary)' }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={`${appName} logo`}
            className='h-6 w-auto object-contain'
          />
        ) : (
          <div className='h-6 w-6 rounded bg-white/30' />
        )}
        <span
          className='text-sm font-semibold text-white'
          style={secondaryColor ? { color: secondaryColor } : {}}
        >
          {appName}
        </span>
      </div>

      {/* Card body mock */}
      <VStack gap={4} className='bg-card px-6 py-6'>
        <Heading level={3} size='lg'>
          Welcome back
        </Heading>
        <Text size='sm' color='muted-foreground'>
          Sign in to your {appName} account.
        </Text>

        {/* Mock social button */}
        <div
          className='flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white'
          style={
            primaryColor
              ? btnStyle
              : {
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }
          }
          role='img'
          aria-label='Sample sign-in button'
        >
          Sign in with Google
        </div>

        {/* Mock form fields */}
        <div className='space-y-2'>
          <div className='bg-muted h-4 w-16 rounded' />
          <div className='border-border bg-background h-8 w-full rounded border' />
        </div>
        <div className='space-y-2'>
          <div className='bg-muted h-4 w-16 rounded' />
          <div className='border-border bg-background h-8 w-full rounded border' />
        </div>

        {/* Mock submit button */}
        <div
          className='flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white'
          style={
            primaryColor
              ? btnStyle
              : {
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }
          }
          role='img'
          aria-label='Sample submit button'
        >
          Log in
        </div>
      </VStack>
    </Stack>
  );
}
