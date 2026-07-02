/**
 * Human labels for CalendarTypeEnum, used as the secondary line in the
 * calendar target picker so admins can tell a bundle calendar apart from a
 * personal or resource one.
 */

import type { CalendarTypeEnum } from '@/client';

export const CALENDAR_TYPE_LABELS: Record<CalendarTypeEnum, string> = {
  personal: 'Personal calendar',
  resource: 'Resource calendar',
  virtual: 'Virtual calendar',
  bundle: 'Bundle calendar',
};
