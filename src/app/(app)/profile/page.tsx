'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Stack } from '@/components/layout/stack';
import { HStack } from '@/components/layout/flex';
import { Text } from '@/components/layout/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';

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
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [pendingPictureUrl, setPendingPictureUrl] = React.useState<string | null>(null);

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
      const s3Url = await uploadProfilePicture(file, (pct) => setUploadProgress(pct));
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

      {/* Profile picture */}
      <Card className='max-w-lg'>
        <CardHeader>
          <CardTitle className='text-base'>Profile picture</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <HStack gap={4} align='center'>
              <Skeleton className='size-16 rounded-full' />
              <Skeleton className='h-9 w-32' />
            </HStack>
          ) : (
            <HStack gap={4} align='center'>
              <Avatar className='size-16'>
                <AvatarImage
                  src={previewUrl ?? profile?.profile_picture ?? undefined}
                  alt='Profile picture'
                />
                <AvatarFallback className='bg-teal-100 text-teal-700 text-lg'>
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <Stack gap={2}>
                <input
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
                      <Loader2 className='size-4 animate-spin' />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className='size-4' />
                      Change photo
                    </>
                  )}
                </Button>
                {uploadProgress !== null ? (
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

      {/* Personal information */}
      <Card className='max-w-lg'>
        <CardHeader>
          <CardTitle className='text-base'>Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Stack gap={4}>
              <Skeleton className='h-9 w-full' />
              <Skeleton className='h-9 w-full' />
              <Skeleton className='h-9 w-24' />
            </Stack>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <Stack gap={4}>
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
                  <Button
                    type='submit'
                    disabled={updateProfileMutation.isPending || isUploading}
                    className='self-start'
                  >
                    {updateProfileMutation.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </Stack>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
