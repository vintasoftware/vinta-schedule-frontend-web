import * as React from 'react';

import { cn } from '@/lib/utils/index';
import { HStack } from './flex';
import { Stack } from './stack';
import { Heading } from './heading';
import { Text } from './text';

/**
 * PageHeader — title block at the top of a page body. Optional breadcrumb slot
 * above, description below, and right-aligned actions. Built from layout
 * primitives (Stack / Heading / Text).
 */
export interface PageHeaderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'title'
> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  function PageHeader(
    { className, title, description, actions, breadcrumb, ...props },
    ref
  ) {
    return (
      <Stack
        ref={ref as React.Ref<HTMLElement>}
        gap={4}
        className={cn('@container/pageheader', className)}
        {...props}
      >
        {breadcrumb}
        <div className='flex flex-col gap-3 @lg/pageheader:flex-row @lg/pageheader:items-start @lg/pageheader:justify-between'>
          <Stack gap={1}>
            <Heading level={1} size='2xl'>
              {title}
            </Heading>
            {description ? (
              <Text size='sm' color='muted-foreground'>
                {description}
              </Text>
            ) : null}
          </Stack>
          {actions ? (
            <HStack gap={2} shrink={0}>
              {actions}
            </HStack>
          ) : null}
        </div>
      </Stack>
    );
  }
);

export { PageHeader };
