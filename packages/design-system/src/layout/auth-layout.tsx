import * as React from 'react';

import { Box } from './box';
import { Flex } from './flex';
import { Center } from './center';

/**
 * AuthLayout — public authentication page shell: a top navbar above a single
 * centered column. `variant` only changes how wide that column is:
 *   single     → 448px (one-column forms)
 *   two-column → 768px (a double-width container that splits into two columns
 *                internally — e.g. social sign-in beside the form).
 */
export interface AuthLayoutProps {
  navbar?: React.ReactNode;
  variant?: 'single' | 'two-column';
  className?: string;
  children?: React.ReactNode;
}

function AuthLayout({
  navbar,
  variant = 'single',
  className,
  children,
}: AuthLayoutProps) {
  return (
    <Flex
      direction='column'
      minHeight='screen'
      bg='background'
      color='foreground'
      className={className}
    >
      {navbar}
      <Center as='main' grow={1} px={4} py={12}>
        <Box width='full' maxWidth={variant === 'two-column' ? 768 : 448}>
          {children}
        </Box>
      </Center>
    </Flex>
  );
}

export { AuthLayout };
