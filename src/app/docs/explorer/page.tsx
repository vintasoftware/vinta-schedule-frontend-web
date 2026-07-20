import type { Metadata } from 'next';
import Link from 'next/link';

import { Heading, Stack, Text } from 'vinta-schedule-design-system/layout';
import { Alert, AlertDescription } from 'vinta-schedule-design-system/ui/alert';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { DocsContainer } from '@/components/docs/docs-container';
import { GraphqlExplorer } from '@/components/docs/graphql-explorer';

export const metadata: Metadata = {
  title: 'Explorer',
  description: 'A live GraphiQL console to try requests against /graphql/.',
};

/**
 * Explorer page — hosts the embedded GraphiQL console. The base API URL is
 * read server-side (same env var used to configure the generated clients)
 * and passed down to the client component, so the client boundary doesn't
 * need to know how the env var is resolved.
 */
export default function ExplorerPage() {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

  return (
    <Stack gap={6}>
      {/* Intro + credential note stay at the readable measure… */}
      <DocsContainer>
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading level={1}>Explorer</Heading>
            <Text color='muted-foreground'>
              A live GraphiQL console for the public GraphQL API. Queries and
              mutations you run here hit the real{' '}
              <Text as='span' family='mono'>
                /graphql/
              </Text>{' '}
              endpoint.
            </Text>
          </Stack>

          <Alert>
            <AlertDescription>
              Paste an API credential to authenticate requests. Mint one from
              the{' '}
              <TextLink asChild>
                <Link href='/api-tokens'>API tokens page</Link>
              </TextLink>{' '}
              — tokens are scoped to whichever resources an org admin selected
              when creating them. The credential is held only in this tab&apos;s
              memory for the duration of the session: it is never written to
              local or session storage, and it is cleared as soon as you reload
              the page or press &quot;Clear token&quot;.
            </AlertDescription>
          </Alert>
        </Stack>
      </DocsContainer>

      {/* …the console spans the full content-column width. It caps its own
          credential field to the reading measure internally. */}
      <GraphqlExplorer apiBaseUrl={apiBaseUrl} />
    </Stack>
  );
}
