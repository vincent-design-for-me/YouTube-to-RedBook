'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  // Wait for Supabase to pick up the recovery token from the URL hash
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // Also check if we already have a session (user clicked link, session already set)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/'), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-ed-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <a href="/" className="text-2xl font-serif italic text-ed-primary tracking-tight">
            CopyFlow
          </a>
        </div>

        {success ? (
          <div className="bg-ed-surface-container-lowest border border-ed-outline-variant/10 rounded-2xl p-8 space-y-4 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="font-serif text-xl text-ed-on-background">Password updated!</h2>
            <p className="text-ed-on-surface-variant text-sm">
              Your password has been reset. Redirecting you to the home page...
            </p>
          </div>
        ) : !ready ? (
          <div className="bg-ed-surface-container-lowest border border-ed-outline-variant/10 rounded-2xl p-8 space-y-4 text-center">
            <div className="w-8 h-8 border-2 border-ed-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-ed-on-surface-variant text-sm">
              Verifying your reset link...
            </p>
            <p className="text-ed-on-surface-variant/60 text-xs">
              If this takes too long, the link may have expired.{' '}
              <a href="/" className="text-ed-primary hover:underline">Go back</a> and try again.
            </p>
          </div>
        ) : (
          <div className="bg-ed-surface-container-lowest border border-ed-outline-variant/10 rounded-2xl p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="font-serif text-xl text-ed-on-background">Set a new password</h2>
              <p className="text-ed-on-surface-variant text-sm">
                Enter your new password below.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium text-ed-on-background">
                  New Password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  disabled={submitting}
                  className="w-full bg-ed-surface-container-low border border-ed-outline-variant/20 rounded-xl py-3 px-4 text-ed-on-background text-sm placeholder:text-ed-outline-variant/50 focus:ring-2 focus:ring-ed-primary/20 focus:border-ed-primary/30 h-auto"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-new-password" className="text-sm font-medium text-ed-on-background">
                  Confirm New Password
                </label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  disabled={submitting}
                  className="w-full bg-ed-surface-container-low border border-ed-outline-variant/20 rounded-xl py-3 px-4 text-ed-on-background text-sm placeholder:text-ed-outline-variant/50 focus:ring-2 focus:ring-ed-primary/20 focus:border-ed-primary/30 h-auto"
                />
              </div>

              {error && (
                <div className="bg-ed-error-container/15 border border-ed-error/20 rounded-xl p-3">
                  <p className="text-ed-error text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-b from-ed-primary to-ed-primary-dim text-ed-on-primary py-3.5 rounded-xl text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_24px_rgba(88,94,108,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
