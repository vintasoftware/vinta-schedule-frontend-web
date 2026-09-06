import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { VStack, Heading, Text } from 'vinta-schedule-design-system/layout';

/**
 * AppointmentTypeNotFound — the single rendered output for every reason the appointment type
 * detail route can 404: the appointment type doesn't exist, belongs to another
 * organization, is out of the caller's scope, or the caller isn't
 * authorized to see it (spec UC-8). The component takes no props describing
 * which case occurred, by construction, so it cannot leak which one it was.
 *
 * No redirect — the URL stays put so the browser back button still works.
 */
export function AppointmentTypeNotFound() {
  return (
    <VStack
      gap={3}
      align='center'
      py={16}
      data-testid='appointment-type-not-found'
    >
      <Icon icon={SearchX} size='xl' color='muted-foreground' />
      <Heading level={2} size='lg' align='center'>
        Appointment type not found
      </Heading>
      <Text color='muted-foreground' size='sm' align='center'>
        This appointment type isn&apos;t available. It may not exist, or you may
        not have access to it.
      </Text>
      <TextLink asChild>
        <Link href='/appointment-types'>Back to appointment types</Link>
      </TextLink>
    </VStack>
  );
}
