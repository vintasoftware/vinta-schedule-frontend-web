import Link from 'next/link';
import { Stack } from '@/components/layout/stack';
import { Heading } from '@/components/layout/heading';
import { Text } from '@/components/layout/text';
import { Button } from '@/components/ui/button';
import { Center } from '@/components/layout/center';
import { Flex } from '@/components/layout/flex';

/**
 * No-access page — shown when a disabled user tries to reach any (app) route.
 *
 * This page intentionally lives OUTSIDE the (app) route group so the
 * AppLayoutClient is NOT re-run. If this page were inside (app), a disabled
 * user would hit AppLayoutClient again, re-detect the 403, and loop forever.
 * The AppLayoutClient redirect target /no-access resolves here.
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
        <Flex justify='center'>
          <Button variant='outline' asChild>
            <Link href='/auth/login'>Back to login</Link>
          </Button>
        </Flex>
      </Stack>
    </Center>
  );
}
