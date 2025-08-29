'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { AuthForm } from '@/components/auth-form';
import { SubmitButton } from '@/components/submit-button';
import { register, type RegisterActionState } from '../actions';
import { toast } from '@/components/toast';
import { useSession } from 'next-auth/react';

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    {
      status: 'idle',
    },
  );

  const { update: updateSession } = useSession();

  useEffect(() => {
    if (state.status === 'success') {
      toast({ type: 'success', description: 'Account created successfully!' });
      setIsLoading(true);
      setTimeout(() => {
        router.push('/project');
      }, 1000);
    }

    if (state.status === 'user_exists') {
      toast({ type: 'error', description: 'An account with this email already exists.' });
      setIsLoading(false);
    } else if (state.status === 'failed') {
      toast({ type: 'error', description: 'Failed to create account. Please try again.' });
      setIsLoading(false);
    } else if (state.status === 'invalid_data') {
      toast({
        type: 'error',
        description: 'Please check your input and try again.',
      });
      setIsLoading(false);
    }
  }, [state.status, router]);

  const handleSubmit = (formData: FormData) => {
    setIsLoading(true);
    setEmail(formData.get('email') as string);
    formAction(formData);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-sidebar rounded-lg shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Create Account
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Set up your workspace
            </p>
          </div>

          <AuthForm action={handleSubmit} defaultEmail={email}>
            <SubmitButton isSuccessful={isLoading}>
              {isLoading ? 'Creating account...' : 'Create account'}
            </SubmitButton>
          </AuthForm>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
