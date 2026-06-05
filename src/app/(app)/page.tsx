import { PageHeader } from '@/components/layout/page-header';
import { Stack } from '@/components/layout/stack';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Dashboard — placeholder landing page for the (app) route group.
 *
 * Feature routes light up in later phases; this page links to the areas
 * as they are built so the shell is immediately navigable.
 */
export default function DashboardPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title='Dashboard'
        description='Welcome to Vinta Schedule. Use the sidebar to navigate to your calendars, events, and availability.'
      />
      <div className='grid gap-4 @xl/content:grid-cols-2 @3xl/content:grid-cols-3'>
        <FeatureCard
          title='My Calendars'
          description='View and manage your connected calendars and their sync status.'
          href='/calendars'
        />
        <FeatureCard
          title='Events'
          description='Browse events across your calendars in list, month, or week view.'
          href='/events'
        />
        <FeatureCard
          title='Availability'
          description='Set your available times and manage blocked windows.'
          href='/availability'
        />
      </div>
    </Stack>
  );
}

function FeatureCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className='focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none'
    >
      <Card className='h-full transition-shadow hover:shadow-md'>
        <CardHeader>
          <CardTitle className='text-base'>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </a>
  );
}
