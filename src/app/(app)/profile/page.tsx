'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import { Stack } from 'vinta-schedule-design-system/layout/stack';
import { Box } from 'vinta-schedule-design-system/layout/box';
import { HStack } from 'vinta-schedule-design-system/layout/flex';
import { FormLayout } from 'vinta-schedule-design-system/layout/form-layout';
import { Text } from 'vinta-schedule-design-system/layout/text';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Spinner } from 'vinta-schedule-design-system/ui/spinner';
import { Input } from 'vinta-schedule-design-system/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from 'vinta-schedule-design-system/ui/avatar';
import { Progress } from 'vinta-schedule-design-system/ui/progress';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from 'vinta-schedule-design-system/ui/form';

import { useProfile } from '@/hooks/users/use-profile';
import { useUpdateProfile } from '@/hooks/users/use-update-profile';
import {
  useUploadProfilePicture,
  UploadValidationError,
} from '@/hooks/users/use-upload-profile-picture';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  first_name: z.string().trim().max(150),
  last_name: z.string().trim().max(150),
});

type ProfileSchema = z.infer<typeof profileSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(firstName?: string, lastName?: string): string {
  const parts = [firstName, lastName].filter(Boolean) as string[];
  if (parts.length === 0) return '?';
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}

// ---------------------------------------------------------------------------
// ProfilePage
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const { profile, isLoading } = useProfile();
  const { updateProfile, updateProfileMutation } = useUpdateProfile();
  const { uploadProfilePicture } = useUploadProfilePicture();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(
    null
  );
  const [isUploading, setIsUploading] = React.useState(false);
  const [pendingPictureUrl, setPendingPictureUrl] = React.useState<
    string | null
  >(null);

  const form = useForm<ProfileSchema>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: '', last_name: '' },
  });

  React.useEffect(() => {
    if (profile) {
      form.reset({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
      });
    }
  }, [profile, form]);

  const onSubmit = async (values: ProfileSchema) => {
    try {
      await updateProfile({
        first_name: values.first_name || undefined,
        last_name: values.last_name || undefined,
        ...(pendingPictureUrl ? { profile_picture: pendingPictureUrl } : {}),
      });
      toast.success('Profile updated');
      setPreviewUrl(null);
      setPendingPictureUrl(null);
    } catch {
      toast.error('Failed to update profile — please try again');
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setUploadProgress(0);
    setIsUploading(true);

    try {
      const s3Url = await uploadProfilePicture(file, (pct) =>
        setUploadProgress(pct)
      );
      setPendingPictureUrl(s3Url);
    } catch (err) {
      if (err instanceof UploadValidationError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to upload picture — please try again');
      }
      URL.revokeObjectURL(localUrl);
      setPreviewUrl(null);
      setPendingPictureUrl(null);
    } finally {
      setUploadProgress(null);
      setIsUploading(false);
    }
  };

  const userInitials = initials(profile?.first_name, profile?.last_name);

  return (
    <Stack gap={6}>
      <PageHeader
        title='Profile'
        description='Update your name and profile details.'
      />

      {/* Profile picture. The Box caps the card width — Card itself exposes no
          sizing props. `max-w-lg` = 32rem = 512px. */}
      <Box maxWidth={512}>
        <Card>
          <CardHeader>
            {/* `text-base` — CardTitle exposes no size prop. */}
            <CardTitle className='text-base'>Profile picture</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <HStack gap={4} align='center'>
                <Skeleton shape='circle' width={64} height={64} />
                <Skeleton width={128} height={36} />
              </HStack>
            ) : (
              <HStack gap={4} align='center'>
                {/* `size-16` — Avatar's size is a shadcn internal with no prop. */}
                <Avatar className='size-16'>
                  <AvatarImage
                    src={previewUrl ?? profile?.profile_picture ?? undefined}
                    alt='Profile picture'
                  />
                  {/* AvatarFallback takes no color/size props — the teal tint
                      and text size have to stay as classes.
                      TODO(ds-gap): token props on AvatarFallback. */}
                  <AvatarFallback className='bg-teal-100 text-lg text-teal-700'>
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <Stack gap={2}>
                  {/* The file input is driven programmatically by the button
                      below; it stays display:none (NOT sr-only — an sr-only
                      input would be an unlabeled control for screen readers).
                      Input exposes no display prop. */}
                  <Input
                    ref={fileInputRef}
                    type='file'
                    accept='image/jpeg,image/png,image/webp,image/gif'
                    className='hidden'
                    onChange={onFileChange}
                  />
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <>
                        <Spinner label='' />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload />
                        Change photo
                      </>
                    )}
                  </Button>
                  {uploadProgress !== null ? (
                    // Progress exposes no size props (shadcn internal).
                    <Progress value={uploadProgress} className='h-1.5 w-32' />
                  ) : (
                    <Text size='xs' color='muted-foreground'>
                      JPEG, PNG, WebP or GIF · max 5 MB
                    </Text>
                  )}
                </Stack>
              </HStack>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Personal information */}
      <Box maxWidth={512}>
        <Card>
          <CardHeader>
            {/* `text-base` — CardTitle exposes no size prop. */}
            <CardTitle className='text-base'>Personal information</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Stack gap={4}>
                <Skeleton width='full' height={36} />
                <Skeleton width='full' height={36} />
                <Skeleton width={96} height={36} />
              </Stack>
            ) : (
              <Form {...form}>
                <FormLayout gap={4} onSubmit={form.handleSubmit(onSubmit)}>
                  <FormField
                    control={form.control}
                    name='first_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input placeholder='First name' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='last_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl>
                          <Input placeholder='Last name' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* The Box keeps the submit button at its intrinsic width
                      (the `self-start` idiom) inside the stretched form column. */}
                  <Box>
                    <Button
                      type='submit'
                      disabled={updateProfileMutation.isPending || isUploading}
                    >
                      {updateProfileMutation.isPending
                        ? 'Saving…'
                        : 'Save changes'}
                    </Button>
                  </Box>
                </FormLayout>
              </Form>
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
