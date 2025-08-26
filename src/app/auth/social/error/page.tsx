import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function SocialLoginErrorPage() {
  return (
    <div className='bg-muted flex min-h-screen flex-col items-center justify-center'>
      <Card className='flex w-full max-w-md flex-col items-center gap-6 p-8'>
        <Alert variant='destructive' className='w-full'>
          <AlertTitle className='text-xl font-bold'>
            Social Login Failed
          </AlertTitle>
          <AlertDescription>
            We couldn&apos;t log you in using your social account. Please try
            again or use another login method.
          </AlertDescription>
        </Alert>
        <div className='my-2 w-full border-t border-gray-200' />
        <Button asChild variant='default' className='w-full'>
          <a href='/auth/login'>Back to Login</a>
        </Button>
      </Card>
    </div>
  );
}
