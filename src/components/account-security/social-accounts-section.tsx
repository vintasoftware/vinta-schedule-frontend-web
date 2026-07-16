'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'vinta-schedule-design-system/ui/alert-dialog';
import { VStack, HStack, Text } from 'vinta-schedule-design-system/layout';
import { SocialProviderIcon } from '@/components/authentication/social-provider-icon';

import { ProviderAccount } from '@/auth-client';
import { useAuthConfig } from '@/hooks/authentication/use-auth-config';
import { useAuthUser } from '@/hooks/authentication/use-auth-user';
import { useAccountProviders } from '@/hooks/authentication/use-account-providers';
import { useConnectProvider } from '@/hooks/authentication/use-connect-provider';
import { useDisconnectProvider } from '@/hooks/authentication/use-disconnect-provider';
import { isAllauthBadRequest } from '@/lib/allauth-form-errors';

/**
 * Link/unlink social accounts. Linking matters beyond login: external
 * calendar sync uses the OAuth tokens captured at link time, so an
 * email-signup user must connect Google here to enable Google Calendar sync.
 */
export function SocialAccountsSection() {
  const { authConfig, isLoading: isConfigLoading } = useAuthConfig();
  const { user } = useAuthUser();
  const { providerAccounts, isLoading: isAccountsLoading } =
    useAccountProviders();
  const { connectProvider, connectProviderMutation } = useConnectProvider();
  const { disconnectProvider, disconnectProviderMutation } =
    useDisconnectProvider();
  const [accountToDisconnect, setAccountToDisconnect] =
    useState<ProviderAccount | null>(null);

  // Enabled providers come from the allauth config endpoint — env-driven,
  // never hardcoded.
  const providers = authConfig?.data?.socialaccount?.providers ?? [];
  const isLoading = isConfigLoading || isAccountsLoading;

  const handleConnect = async (providerId: string) => {
    try {
      const { redirect_url: redirectUrl } = await connectProvider({
        provider: providerId,
        callbackUrl: `${window.location.origin}/account/provider/callback?provider=${providerId}`,
      });
      window.location.href = redirectUrl;
    } catch {
      toast.error('Could not start the connection. Please try again.');
    }
  };

  const handleDisconnect = async (account: ProviderAccount) => {
    try {
      await disconnectProvider({
        provider: account.provider.id,
        account: account.uid,
      });
      toast.success(`${account.provider.name} disconnected.`);
    } catch (error) {
      if (isAllauthBadRequest(error) && error.errors[0]) {
        const hint =
          user?.has_usable_password === false
            ? ' Set a password first so you can still log in.'
            : '';
        toast.error(`${error.errors[0].message}${hint}`);
      } else {
        toast.error('Could not disconnect this account. Please try again.');
      }
    } finally {
      setAccountToDisconnect(null);
    }
  };

  if (!isConfigLoading && providers.length === 0) {
    return null; // no providers enabled in this environment
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>
          Link a social account to log in with it. Connecting Google also
          enables Google Calendar sync.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <VStack gap={3}>
            <Skeleton height={40} width='full' />
            <Skeleton height={40} width='full' />
          </VStack>
        ) : (
          <VStack gap={3}>
            {providers.map((provider) => {
              const linkedAccounts = providerAccounts.filter(
                (account) => account.provider.id === provider.id
              );
              return (
                <VStack key={provider.id} gap={2}>
                  <HStack justify='between' align='center' gap={4}>
                    <HStack align='center' gap={2}>
                      <SocialProviderIcon provider={provider} />
                      <Text weight='medium'>{provider.name}</Text>
                      {linkedAccounts.length > 0 && (
                        <Badge variant='secondary'>Connected</Badge>
                      )}
                    </HStack>
                    {linkedAccounts.length === 0 && (
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={connectProviderMutation.isPending}
                        onClick={() => handleConnect(provider.id)}
                      >
                        Connect
                      </Button>
                    )}
                  </HStack>
                  {linkedAccounts.map((account) => (
                    <HStack
                      key={account.uid}
                      justify='between'
                      align='center'
                      gap={4}
                      pl={6}
                    >
                      <Text size='sm' color='muted-foreground'>
                        {account.display}
                      </Text>
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled={disconnectProviderMutation.isPending}
                        onClick={() => setAccountToDisconnect(account)}
                      >
                        Disconnect
                      </Button>
                    </HStack>
                  ))}
                </VStack>
              );
            })}
          </VStack>
        )}
      </CardContent>

      <AlertDialog
        open={Boolean(accountToDisconnect)}
        onOpenChange={(open) => {
          if (!open) setAccountToDisconnect(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {accountToDisconnect?.provider.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to log in with this account, and any
              calendar sync that relies on it will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (accountToDisconnect) {
                  handleDisconnect(accountToDisconnect);
                }
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
