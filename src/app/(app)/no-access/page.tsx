import Link from 'next/link';
import { Stack } from '@/components/layout/stack';
import { Heading } from '@/components/layout/heading';
import { Text } from '@/components/layout/text';
import { Button } from '@/components/ui/button';
import { Center } from '@/components/layout/center';

/**
 * No-access page — shown when a disabled user tries to reach any (app) route.
 *
 * This page lives inside the (app) route group directory, but the AppLayout
 * routes disabled users HERE (not back into the shell), so it renders without
 * the shell wrapper to avoid an infinite redirect loop.
 *
 * Note: the layout.tsx redirect points to /no-access (absolute path), which
 * resolves to this page via the (app) group.
 */
export default function NoAccessPage() {
  return (
    <Center minHeight='screen'>
      <Stack gap={6} className='max-w-sm text-center'>
        <Stack gap={2}>
          <Heading level={1} size='2xl'>
            Access Disabled
          </Heading>
          <Text color='muted-foreground'>
            Your account has been deactivated. Please contact your organization
            administrator to regain access.
          </Text>
        </Stack>
        <div className='flex justify-center'>
          <Button variant='outline' asChild>
            <Link href='/auth/login'>Back to login</Link>
          </Button>
        </div>
      </Stack>
    </Center>
  );
}
