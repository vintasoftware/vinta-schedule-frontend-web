import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from 'vinta-schedule-design-system/ui/card';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import {
  Stack,
  VStack,
  HStack,
  Text,
} from 'vinta-schedule-design-system/layout';
import type { CalendarGroup } from '@/client';
import { SlotRoster } from './slot-roster';

export interface GroupDetailViewProps {
  group: CalendarGroup;
}

/**
 * GroupDetailView — the group detail page's body: a header with the group's
 * name and description, then one section per slot showing its name,
 * required count, and roster (SlotRoster).
 *
 * Editing the group, its slots, or the slot rosters is out of scope for this
 * page — everything here is read-only (Non-goals, plan §1).
 */
export function GroupDetailView({ group }: GroupDetailViewProps) {
  return (
    <Stack gap={6}>
      <PageHeader title={group.name} description={group.description} />
      {group.slots.length === 0 ? (
        <Text color='muted-foreground' size='sm'>
          This group has no slots.
        </Text>
      ) : (
        <VStack gap={4}>
          {group.slots.map((slot) => (
            <Card key={slot.id} data-testid={`slot-section-${slot.id}`}>
              <CardHeader>
                <HStack gap={2} align='center' justify='between'>
                  <CardTitle>{slot.name}</CardTitle>
                  <Badge variant='secondary'>
                    Requires {slot.required_count ?? 1}
                  </Badge>
                </HStack>
                {slot.description ? (
                  <CardDescription>{slot.description}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                <SlotRoster groupId={group.id} slot={slot} />
              </CardContent>
            </Card>
          ))}
        </VStack>
      )}
    </Stack>
  );
}
