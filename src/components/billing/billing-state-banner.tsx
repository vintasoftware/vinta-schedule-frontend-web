/**
 * BillingStateBanner — surfaces the organization's `billing_state` at the top of
 * the billing overview (`GET /billing/usage/` → `billing_state`, lowercase from
 * the API).
 *
 * It maps each state to a friendly label + an appropriate design-system Alert
 * intent. For GRACE / RESTRICTED it also shows the grace deadline
 * (`grace_period_ends_at`, via `formatPeriod`) and a "Resolve payment" link to
 * the recovery surface at `/billing/resolve-payment` (built in Phase 5 — linked
 * here regardless, per the plan). ACTIVE / FREE carry no deadline and no link;
 * the whole banner is informational, never a dunning console (Non-goals).
 *
 * Presentational: it renders from props only, so it stays a Server Component.
 */

import Link from 'next/link';
import { CheckCircle2, CircleSlash, Clock, Lock } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { HStack, Text, VStack } from 'vinta-schedule-design-system/layout';

import { formatPeriod } from '@/lib/billing/format';

type AlertVariant = 'default' | 'success' | 'warning' | 'destructive';

interface StateConfig {
  label: string;
  variant: AlertVariant;
  icon: typeof CheckCircle2;
  /** Whether this state shows the grace deadline + resolve-payment link. */
  needsResolution: boolean;
  description: string;
}

// The lowercase API `billing_state` values → their friendly presentation. The
// enum carries `cancelled` too (a plan cancelled but running to period end); it
// is mapped defensively so an unexpected-but-valid state never renders bare.
const STATE_CONFIG: Record<string, StateConfig> = {
  active: {
    label: 'Active',
    variant: 'success',
    icon: CheckCircle2,
    needsResolution: false,
    description: 'Your subscription is active and in good standing.',
  },
  free: {
    label: 'Free',
    variant: 'default',
    icon: CheckCircle2,
    needsResolution: false,
    description: 'You are on the free plan.',
  },
  grace: {
    label: 'Grace period',
    variant: 'warning',
    icon: Clock,
    needsResolution: true,
    description:
      'A recent payment did not go through. Resolve it before the grace period ends to keep full access.',
  },
  restricted: {
    label: 'Restricted',
    variant: 'destructive',
    icon: Lock,
    needsResolution: true,
    description:
      'Access is restricted because a payment could not be collected. Resolve payment to restore your plan.',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'warning',
    icon: CircleSlash,
    needsResolution: false,
    description:
      'Your plan is cancelled and will run until the end of the current period, then fall back to free.',
  },
};

function configFor(billingState: string): StateConfig {
  return (
    STATE_CONFIG[billingState] ?? {
      label: billingState,
      variant: 'default',
      icon: CheckCircle2,
      needsResolution: false,
      description: 'Your current billing status.',
    }
  );
}

export interface BillingStateBannerProps {
  /** The lowercase `billing_state` from `GET /billing/usage/`. */
  billingState: string;
  /**
   * The subscription's `grace_period_ends_at` (ISO datetime). Shown only in
   * GRACE / RESTRICTED; `null` when there is no active dunning window.
   */
  gracePeriodEndsAt?: string | null;
}

export function BillingStateBanner({
  billingState,
  gracePeriodEndsAt,
}: BillingStateBannerProps) {
  const config = configFor(billingState);

  return (
    <Alert variant={config.variant} data-testid='billing-state-banner'>
      <Icon icon={config.icon} />
      <AlertTitle>Billing status: {config.label}</AlertTitle>
      <AlertDescription>
        <VStack gap={2} align='start'>
          <Text size='sm'>{config.description}</Text>
          {config.needsResolution ? (
            <VStack gap={1} align='start'>
              {gracePeriodEndsAt ? (
                <Text size='sm' data-testid='grace-deadline'>
                  Grace period ends {formatPeriod(gracePeriodEndsAt)}.
                </Text>
              ) : null}
              <HStack gap={2}>
                <TextLink asChild variant='inherit' underline='always'>
                  <Link href='/billing/resolve-payment'>Resolve payment</Link>
                </TextLink>
              </HStack>
            </VStack>
          ) : null}
        </VStack>
      </AlertDescription>
    </Alert>
  );
}
