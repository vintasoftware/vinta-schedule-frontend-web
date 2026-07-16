import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CalendarPlus } from 'lucide-react';

import { AppShell } from 'vinta-schedule-design-system/layout/app-shell';
import { AppSidebar } from '@/components/navigation/app-sidebar';
import { AppTopbar } from 'vinta-schedule-design-system/layout/app-topbar';
import { AuthLayout } from 'vinta-schedule-design-system/layout/auth-layout';
import { Navbar } from 'vinta-schedule-design-system/layout/navbar';
import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Label } from 'vinta-schedule-design-system/ui/label';
import { SchedulingChip } from 'vinta-schedule-design-system/ui/scheduling-chip';

const meta: Meta = {
  title: 'Page Layouts',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

/* --------------------------------- helpers -------------------------------- */

const sidebar = <AppSidebar />;
const topbar = (
  <AppTopbar
    title='Calendar'
    subtitle='This week · 3 bookings'
    actions={<NewBookingAction />}
  />
);

// Consumer-supplied action: collapses to an icon button at narrow topbar
// widths (the `@container/topbar` is provided by AppTopbar).
function NewBookingAction() {
  return (
    <>
      <Button
        size='icon'
        aria-label='New booking'
        className='shrink-0 @3xl/topbar:hidden'
      >
        <CalendarPlus />
      </Button>
      <Button size='sm' className='hidden shrink-0 @3xl/topbar:inline-flex'>
        <CalendarPlus />
        New booking
      </Button>
    </>
  );
}

function DashboardBody() {
  return (
    <>
      <PageHeader
        title='Bookings'
        description='Upcoming appointments across your connected calendars.'
        actions={<Button size='sm'>New booking</Button>}
      />
      {/* Reacts to the page-body width (@container/content), not the viewport:
          collapses sidebar → wider body → more columns. */}
      <div className='mt-6 grid gap-4 @xl/content:grid-cols-2 @4xl/content:grid-cols-3'>
        {['Monday', 'Tuesday', 'Wednesday'].map((day) => (
          <Card key={day}>
            <CardHeader>
              <CardTitle className='text-base'>{day}</CardTitle>
              <CardDescription>3 slots</CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              <SchedulingChip
                status='booked'
                title='Prenatal intake'
                meta='9:00 · Dr. Pires'
              />
              <SchedulingChip
                status='available'
                title='Available'
                meta='10:00 · Open'
              />
              <SchedulingChip
                status='tentative'
                title='Hold'
                meta='11:00 · Pending'
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function SignInCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-xl'>Welcome back</CardTitle>
        <CardDescription>
          Sign in to your Vinta Schedule account.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-2'>
          <Label htmlFor='email'>Email</Label>
          <Input id='email' type='email' placeholder='you@clinic.com' />
        </div>
        <div className='grid gap-2'>
          <Label htmlFor='password'>Password</Label>
          <Input id='password' type='password' placeholder='••••••••' />
        </div>
        <Button className='w-full'>Sign in</Button>
        <Button variant='outline' className='w-full'>
          Continue with Google
        </Button>
      </CardContent>
    </Card>
  );
}

function SignUpTwoColumnCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-xl'>Create your account</CardTitle>
        <CardDescription>
          Start aggregating calendars in minutes — no card required.
        </CardDescription>
      </CardHeader>
      <CardContent className='@xl/authcard:divide-border @container/authcard grid gap-6 @xl/authcard:grid-cols-2 @xl/authcard:divide-x'>
        {/* Left — social sign-in */}
        <div className='space-y-3 @xl/authcard:pr-6'>
          <p className='text-muted-foreground text-sm font-medium'>
            Sign up with
          </p>
          <Button variant='outline' className='w-full'>
            Continue with Google
          </Button>
          <Button variant='outline' className='w-full'>
            Continue with Microsoft
          </Button>
          <Button variant='outline' className='w-full'>
            Continue with Apple
          </Button>
        </div>

        {/* Right — email form */}
        <div className='space-y-4 @xl/authcard:pl-6'>
          <div className='grid gap-2'>
            <Label htmlFor='su-name'>Full name</Label>
            <Input id='su-name' placeholder='Renata Pires' />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='su-email'>Work email</Label>
            <Input id='su-email' type='email' placeholder='you@clinic.com' />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='su-password'>Password</Label>
            <Input id='su-password' type='password' placeholder='••••••••' />
          </div>
          <Button className='w-full'>Create account</Button>
        </div>
      </CardContent>
    </Card>
  );
}

const authNavbar = (
  <Navbar
    actions={
      <>
        <Button variant='ghost' size='sm'>
          Log in
        </Button>
        <Button size='sm'>Sign up</Button>
      </>
    }
  />
);

/* ------------------------------ generic layouts --------------------------- */

export const SidebarTopbarFull: Story = {
  name: 'Sidebar + Topbar · full width',
  render: () => (
    <AppShell sidebar={sidebar} topbar={topbar} width='full'>
      <DashboardBody />
    </AppShell>
  ),
};

export const SidebarTopbarContained: Story = {
  name: 'Sidebar + Topbar · contained',
  render: () => (
    <AppShell sidebar={sidebar} topbar={topbar} width='contained'>
      <DashboardBody />
    </AppShell>
  ),
};

export const TopbarFull: Story = {
  name: 'No sidebar + Topbar · full width',
  render: () => (
    <AppShell topbar={topbar} width='full'>
      <DashboardBody />
    </AppShell>
  ),
};

export const TopbarContained: Story = {
  name: 'No sidebar + Topbar · contained',
  render: () => (
    <AppShell topbar={topbar} width='contained'>
      <DashboardBody />
    </AppShell>
  ),
};

export const NoBarsFull: Story = {
  name: 'No bars · full width',
  render: () => (
    <AppShell width='full'>
      <DashboardBody />
    </AppShell>
  ),
};

export const NoBarsContained: Story = {
  name: 'No bars · contained',
  render: () => (
    <AppShell width='contained'>
      <DashboardBody />
    </AppShell>
  ),
};

/* -------------------------------- auth layouts ---------------------------- */

export const AuthSingleColumn: Story = {
  name: 'Auth · top navbar · single column',
  render: () => (
    <AuthLayout navbar={authNavbar} variant='single'>
      <SignInCard />
    </AuthLayout>
  ),
};

export const AuthTwoColumns: Story = {
  name: 'Auth · top navbar · two columns',
  render: () => (
    <AuthLayout navbar={authNavbar} variant='two-column'>
      <SignUpTwoColumnCard />
    </AuthLayout>
  ),
};

/* ------------------------------ mobile previews --------------------------- */
/* Same layouts, opened at a phone width so the responsive collapse is visible
   on load: sidebar → drawer, topbar controls hide, content → single column,
   navbar links → hamburger menu. Switch any story's width via the toolbar's
   viewport control. */

export const SidebarTopbarMobile: Story = {
  name: 'Mobile · sidebar drawer + topbar',
  globals: { viewport: { value: 'mobile' } },
  render: () => (
    <AppShell sidebar={sidebar} topbar={topbar} width='full'>
      <DashboardBody />
    </AppShell>
  ),
};

export const AuthTwoColumnsMobile: Story = {
  name: 'Mobile · auth two columns (stacked)',
  globals: { viewport: { value: 'mobile' } },
  render: () => (
    <AuthLayout navbar={authNavbar} variant='two-column'>
      <SignUpTwoColumnCard />
    </AuthLayout>
  ),
};
