import * as React from 'react';
import {
  Box,
  Flex,
  HStack,
  Stack,
  VStack,
  Heading,
  Text,
} from 'vinta-schedule-design-system/layout';
import { Image } from 'vinta-schedule-design-system/ui/image';

// ---------------------------------------------------------------------------
// BrandingPreview — a self-contained mock of the auth interstitial card,
// driven purely by form values. Intentionally avoids importing branding-server
// or branding-shared (those live on a separate branch). Inlines the preview
// logic so this feature is fully self-contained.
//
// Composed entirely from design-system primitives: no raw elements, no utility
// classes. The brand colors are arbitrary runtime values from the form, which
// the token props accept directly — `color()` passes any raw CSS color through
// untouched, so `bg={primaryColor ?? 'primary'}` falls back to the token when
// the field is empty.
// ---------------------------------------------------------------------------

export interface BrandingPreviewProps {
  appName: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

// A mock control — presentational only, so it is exposed to assistive tech as
// an image with a descriptive name rather than as an interactive button.
// Defined at module scope: a component created during render is remounted on
// every parent render (and the React Compiler rejects it).
function MockButton({
  label,
  surface,
  onSurface,
}: {
  label: string;
  surface: string;
  onSurface: string;
}) {
  return (
    <Flex
      width='full'
      align='center'
      justify='center'
      px={4}
      py={2}
      radius='md'
      bg={surface}
      role='img'
      aria-label={`Sample ${label.toLowerCase()} button`}
    >
      <Text size='sm' weight='medium' color={onSurface}>
        {label}
      </Text>
    </Flex>
  );
}

/** A mock form row: a label bar above an input bar. */
function MockField() {
  return (
    <VStack gap={2}>
      <Box width={64} height={16} radius='md' bg='muted' />
      <Box
        width='full'
        height={32}
        radius='md'
        bg='background'
        border
        borderColor='border'
      />
    </VStack>
  );
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
  const surface = primaryColor ?? 'primary';
  const onSurface = secondaryColor ?? 'primary-foreground';

  return (
    <Stack gap={0} width='full' overflow='hidden' radius='md'>
      {/* Header strip */}
      <HStack gap={2} px={4} py={3} align='center' bg={surface}>
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={`${appName} logo`}
            height={24}
            fit='contain'
          />
        ) : (
          <Box width={24} height={24} radius='sm' bg='rgb(255 255 255 / 0.3)' />
        )}
        <Text size='sm' weight='semibold' color={onSurface}>
          {appName}
        </Text>
      </HStack>

      {/* Card body mock */}
      <VStack gap={4} px={6} py={6} bg='card'>
        <Heading level={3} size='lg'>
          Welcome back
        </Heading>
        <Text size='sm' color='muted-foreground'>
          Sign in to your {appName} account.
        </Text>

        <MockButton
          label='Sign in with Google'
          surface={surface}
          onSurface={onSurface}
        />

        <MockField />
        <MockField />

        <MockButton label='Log in' surface={surface} onSurface={onSurface} />
      </VStack>
    </Stack>
  );
}
