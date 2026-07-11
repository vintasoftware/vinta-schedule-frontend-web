'use client';

/**
 * ServiceAccountWizard — step-by-step flow that walks an admin through creating
 * a Google service account with the permissions required for rooms sync, then
 * shows the form to register that service account with vinta-schedule.
 *
 * Steps:
 *  1. Create a service account in Google Cloud.
 *  2. Enable the required Google APIs.
 *  3. Grant domain-wide delegation for the rooms-sync scopes.
 *  4. Create & download a JSON key.
 *  5. Add the service account to vinta-schedule (the form).
 *
 * When `isRotating` is true the wizard opens directly on the form step — the
 * account already exists, so the operator only needs to supply a fresh key.
 *
 * SECURITY invariants (inherited from the previous inline form):
 *  - Credentials (private_key, private_key_id) are NEVER pre-populated
 *    (the read model never returns them anyway).
 *  - Form state is cleared entirely when the dialog closes.
 *  - No console.log / console.error with credential values.
 *  - Credentials live only in react-hook-form local state; never in the cache.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from 'vinta-schedule-design-system/ui/dialog';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Textarea } from 'vinta-schedule-design-system/ui/textarea';
import { Progress } from 'vinta-schedule-design-system/ui/progress';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';
import { VStack, HStack, Text, Box } from 'vinta-schedule-design-system/layout';
import { useUpsertServiceAccount } from '@/hooks/service-accounts/use-service-account';

// ---------------------------------------------------------------------------
// Rooms-sync scopes — these MUST match the backend `_SA_SCOPES`
// (calendar_integration/services/calendar_adapters/google_calendar_adapter.py).
// They are the domain-wide-delegation scopes the service account needs to list
// resource calendars (rooms) and read their availability.
// ---------------------------------------------------------------------------

const ROOMS_SYNC_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
] as const;

const SCOPES_CSV = ROOMS_SYNC_SCOPES.join(',');

// ---------------------------------------------------------------------------
// Zod schema — public_key was removed on the API (the backend now derives the
// public certificate from the private key), so the form only needs the JSON
// key fields plus the impersonation admin email.
// ---------------------------------------------------------------------------

const serviceAccountSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Must be a valid email address' }),
  admin_email: z
    .string()
    .trim()
    .min(1, { message: 'Admin email is required' })
    .email({ message: 'Must be a valid email address' }),
  private_key_id: z
    .string()
    .trim()
    .min(1, { message: 'Private key ID is required' }),
  private_key: z.string().trim().min(1, { message: 'Private key is required' }),
});

type ServiceAccountSchema = z.infer<typeof serviceAccountSchema>;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function ExternalAnchor({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className='text-primary inline-flex items-center gap-1 font-medium underline underline-offset-2'
    >
      {children}
      <ExternalLink className='h-3.5 w-3.5' aria-hidden='true' />
    </a>
  );
}

function OrderedSteps({ children }: { children: React.ReactNode }) {
  return (
    <ol className='text-muted-foreground list-decimal space-y-2 pl-5 text-sm'>
      {children}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Instruction step content
// ---------------------------------------------------------------------------

interface StepDef {
  title: string;
  description: string;
  content: React.ReactNode;
}

const INSTRUCTION_STEPS: StepDef[] = [
  {
    title: 'Create a service account',
    description: 'Create a dedicated service account in Google Cloud.',
    content: (
      <OrderedSteps>
        <li>
          Open the{' '}
          <ExternalAnchor href='https://console.cloud.google.com/iam-admin/serviceaccounts'>
            Google Cloud service accounts page
          </ExternalAnchor>{' '}
          and select (or create) the project for your organization.
        </li>
        <li>
          Click <strong>Create service account</strong>, give it a name such as{' '}
          <code className='font-mono text-xs'>vinta-schedule-rooms</code>, then
          click <strong>Done</strong>. No project-level roles are required.
        </li>
        <li>
          Open the new service account and copy its{' '}
          <strong>Unique ID (Client ID)</strong> — you&apos;ll need it in
          step&nbsp;3.
        </li>
      </OrderedSteps>
    ),
  },
  {
    title: 'Enable the required APIs',
    description: 'Turn on the APIs the service account will call.',
    content: (
      <OrderedSteps>
        <li>
          Enable the{' '}
          <ExternalAnchor href='https://console.cloud.google.com/apis/library/admin.googleapis.com'>
            Admin SDK API
          </ExternalAnchor>{' '}
          for the project.
        </li>
        <li>
          Enable the{' '}
          <ExternalAnchor href='https://console.cloud.google.com/apis/library/calendar-json.googleapis.com'>
            Google Calendar API
          </ExternalAnchor>{' '}
          for the project.
        </li>
      </OrderedSteps>
    ),
  },
  {
    title: 'Grant domain-wide delegation',
    description:
      'Authorize the service account to read rooms across the domain.',
    content: (
      <VStack gap={3}>
        <OrderedSteps>
          <li>
            Open the{' '}
            <ExternalAnchor href='https://admin.google.com/ac/owl/domainwidedelegation'>
              Domain-wide delegation page
            </ExternalAnchor>{' '}
            in the Google Admin Console (you must be a super-admin).
          </li>
          <li>
            Click <strong>Add new</strong> and paste the service account&apos;s{' '}
            <strong>Client ID</strong> from step&nbsp;1.
          </li>
          <li>
            In <strong>OAuth scopes</strong>, paste the two scopes below
            (comma-separated), then click <strong>Authorize</strong>.
          </li>
        </OrderedSteps>
        <Box p={3} radius='md' border borderColor='border' bg='muted'>
          <Text
            size='xs'
            family='mono'
            className='break-all whitespace-pre-wrap'
          >
            {SCOPES_CSV}
          </Text>
        </Box>
        <Text size='xs' color='muted-foreground'>
          The <strong>admin email</strong> you enter in the final step must be a
          Google Workspace super-admin in this domain — the service account
          impersonates it to list rooms.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Create & download a JSON key',
    description: 'Generate the key file you will paste in the next step.',
    content: (
      <OrderedSteps>
        <li>
          Back in the{' '}
          <ExternalAnchor href='https://console.cloud.google.com/iam-admin/serviceaccounts'>
            service accounts page
          </ExternalAnchor>
          , open your service account and go to the <strong>Keys</strong> tab.
        </li>
        <li>
          Click <strong>Add key → Create new key</strong>, choose{' '}
          <strong>JSON</strong>, and click <strong>Create</strong>. The key file
          downloads automatically.
        </li>
        <li>
          Keep the file handy — you&apos;ll paste its contents in the next step.
          Treat it like a password and delete it once configured.
        </li>
      </OrderedSteps>
    ),
  },
];

// ---------------------------------------------------------------------------
// ServiceAccountWizard
// ---------------------------------------------------------------------------

export interface ServiceAccountWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingId?: number;
  isRotating: boolean;
}

export function ServiceAccountWizard({
  open,
  onOpenChange,
  existingId,
  isRotating,
}: ServiceAccountWizardProps) {
  const { saveServiceAccount, isPending } = useUpsertServiceAccount();

  // The form step is the last step; instruction steps come before it.
  const formStepIndex = INSTRUCTION_STEPS.length;
  const totalSteps = INSTRUCTION_STEPS.length + 1;

  // Rotating accounts skip straight to the form — setup was already done once.
  const initialStep = isRotating ? formStepIndex : 0;
  const [step, setStep] = React.useState(initialStep);

  const form = useForm<ServiceAccountSchema>({
    resolver: zodResolver(serviceAccountSchema),
    defaultValues: {
      email: '',
      admin_email: '',
      private_key_id: '',
      private_key: '',
    },
  });

  const [pasteJson, setPasteJson] = React.useState('');

  // SECURITY: clear all form state (including credentials) and reset the step
  // when the dialog closes, so pasted private keys don't linger in memory.
  React.useEffect(() => {
    if (!open) {
      form.reset();
      setPasteJson('');
      setStep(initialStep);
    }
  }, [open, form, initialStep]);

  // ---------------------------------------------------------------------------
  // Optional: paste Google service-account JSON for convenience.
  // Best-effort: maps client_email→email, private_key→private_key,
  // private_key_id→private_key_id. admin_email requires manual entry.
  // With public_key removed, a pasted JSON now fills every field except
  // admin_email.
  // ---------------------------------------------------------------------------
  const handlePasteJson = (raw: string) => {
    setPasteJson(raw);
    if (!raw.trim()) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.client_email === 'string' && parsed.client_email) {
        form.setValue('email', parsed.client_email, { shouldValidate: false });
      }
      if (typeof parsed.private_key === 'string' && parsed.private_key) {
        form.setValue('private_key', parsed.private_key, {
          shouldValidate: false,
        });
      }
      if (typeof parsed.private_key_id === 'string' && parsed.private_key_id) {
        form.setValue('private_key_id', parsed.private_key_id, {
          shouldValidate: false,
        });
      }
    } catch {
      // Not valid JSON — ignore silently; user can still fill fields manually.
    }
  };

  const onSubmit = async (values: ServiceAccountSchema) => {
    try {
      await saveServiceAccount(values, existingId);
      toast.success(
        isRotating
          ? 'Service account credentials rotated'
          : 'Service account configured'
      );
      onOpenChange(false);
    } catch (err) {
      // SECURITY: never log the values/credentials here.
      toast.error(
        isRotating
          ? 'Failed to rotate service account credentials'
          : 'Failed to configure service account',
        {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        }
      );
    }
  };

  const onFormStep = step === formStepIndex;
  const currentInstruction = onFormStep ? null : INSTRUCTION_STEPS[step];

  const title = onFormStep
    ? isRotating
      ? 'Rotate service account credentials'
      : 'Add service account to vinta-schedule'
    : currentInstruction!.title;

  const description = onFormStep
    ? 'Paste the JSON key you downloaded and enter the impersonation admin email.'
    : currentInstruction!.description;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <VStack gap={2}>
          <HStack justify='between' align='center'>
            <Text size='xs' color='muted-foreground'>
              Step {step + 1} of {totalSteps}
            </Text>
          </HStack>
          <Progress value={((step + 1) / totalSteps) * 100} />
        </VStack>

        {onFormStep ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className='flex flex-col gap-4'
              noValidate
            >
              <VStack gap={1}>
                <Text size='sm' color='muted-foreground'>
                  Paste Google service-account JSON (fills email and private key
                  fields)
                </Text>
                <Textarea
                  placeholder='Paste JSON here…'
                  value={pasteJson}
                  onChange={(e) => handlePasteJson(e.target.value)}
                  rows={3}
                  className='font-mono text-xs'
                  autoComplete='off'
                  data-testid='paste-json-textarea'
                />
              </VStack>

              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service account email</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder='my-service-account@project.iam.gserviceaccount.com'
                        autoComplete='off'
                        {...field}
                        data-testid='service-account-email'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='admin_email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin email</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder='admin@yourdomain.com'
                        autoComplete='off'
                        {...field}
                        data-testid='service-account-admin-email'
                      />
                    </FormControl>
                    <FormDescription>
                      A Google Workspace super-admin the service account
                      impersonates to list rooms.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='private_key_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Private key ID</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        autoComplete='off'
                        {...field}
                        data-testid='service-account-private-key-id'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='private_key'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Private key</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='-----BEGIN PRIVATE KEY-----'
                        autoComplete='off'
                        rows={4}
                        className='font-mono text-xs'
                        style={
                          { WebkitTextSecurity: 'disc' } as React.CSSProperties
                        }
                        {...field}
                        data-testid='service-account-private-key'
                      />
                    </FormControl>
                    <FormDescription>
                      Cleared when you close this dialog.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  // When rotating we open straight on the form, so this jumps
                  // back to the start of the setup instructions. When creating
                  // it walks back to the last instruction step.
                  onClick={() => setStep(isRotating ? 0 : formStepIndex - 1)}
                  disabled={isPending}
                  data-testid={
                    isRotating ? 'wizard-view-instructions' : 'wizard-back'
                  }
                >
                  {isRotating ? 'View setup instructions' : 'Back'}
                </Button>
                <Button
                  type='submit'
                  disabled={isPending}
                  data-testid='save-service-account-submit'
                >
                  {isPending
                    ? 'Saving…'
                    : isRotating
                      ? 'Rotate credentials'
                      : 'Add service account'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <>
            <Box className='min-h-[12rem]'>{currentInstruction!.content}</Box>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                data-testid='wizard-back'
              >
                Back
              </Button>
              <Button
                type='button'
                onClick={() => setStep((s) => s + 1)}
                data-testid='wizard-next'
              >
                {step === formStepIndex - 1 ? 'Go to form' : 'Next'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
