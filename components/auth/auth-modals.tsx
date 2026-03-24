'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/context/auth-context';

function SignUpForm() {
  const { openSignIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    const result = await signUp(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || 'Sign up failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <DialogTitle>Create your account</DialogTitle>
        <DialogDescription>
          Get full access to transcripts, Xiaohongshu content generation, and AI-powered images.
        </DialogDescription>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="signup-email" className="text-sm font-medium text-ed-on-background">
            Email
          </label>
          <Input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={submitting}
            className="w-full bg-ed-surface-container-low border border-ed-outline-variant/20 rounded-xl py-3 px-4 text-ed-on-background text-sm placeholder:text-ed-outline-variant/50 focus:ring-2 focus:ring-ed-primary/20 focus:border-ed-primary/30 h-auto"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="signup-password" className="text-sm font-medium text-ed-on-background">
            Password
          </label>
          <Input
            id="signup-password"
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
          <label htmlFor="signup-confirm" className="text-sm font-medium text-ed-on-background">
            Confirm Password
          </label>
          <Input
            id="signup-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
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
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <div className="text-center">
        <p className="text-ed-on-surface-variant text-sm">
          Already have an account?{' '}
          <button
            onClick={openSignIn}
            className="text-ed-primary font-medium hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

function SignInForm() {
  const { openSignUp, openForgotPassword, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || 'Sign in failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <DialogTitle>Welcome back</DialogTitle>
        <DialogDescription>
          Sign in to access your full transcript and content tools.
        </DialogDescription>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="signin-email" className="text-sm font-medium text-ed-on-background">
            Email
          </label>
          <Input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={submitting}
            className="w-full bg-ed-surface-container-low border border-ed-outline-variant/20 rounded-xl py-3 px-4 text-ed-on-background text-sm placeholder:text-ed-outline-variant/50 focus:ring-2 focus:ring-ed-primary/20 focus:border-ed-primary/30 h-auto"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="signin-password" className="text-sm font-medium text-ed-on-background">
              Password
            </label>
            <button
              type="button"
              onClick={openForgotPassword}
              className="text-ed-primary/70 hover:text-ed-primary text-xs font-medium transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="signin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
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
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="text-center">
        <p className="text-ed-on-surface-variant text-sm">
          Don&apos;t have an account?{' '}
          <button
            onClick={openSignUp}
            className="text-ed-primary font-medium hover:underline"
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}

function ForgotPasswordForm() {
  const { openSignIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await resetPassword(email);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || 'Failed to send reset email.');
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <DialogTitle>Check your email</DialogTitle>
          <DialogDescription>
            We&apos;ve sent a password reset link to <strong>{email}</strong>. Click the link in the email to set a new password.
          </DialogDescription>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-800 text-sm">
            Didn&apos;t receive the email? Check your spam folder, or try again in a few minutes.
          </p>
        </div>

        <div className="text-center">
          <button
            onClick={openSignIn}
            className="text-ed-primary font-medium text-sm hover:underline"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <DialogTitle>Reset your password</DialogTitle>
        <DialogDescription>
          Enter your email address and we&apos;ll send you a link to reset your password.
        </DialogDescription>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="reset-email" className="text-sm font-medium text-ed-on-background">
            Email
          </label>
          <Input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
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
          {submitting ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="text-center">
        <button
          onClick={openSignIn}
          className="text-ed-on-surface-variant hover:text-ed-on-surface text-sm transition-colors"
        >
          &larr; Back to Sign In
        </button>
      </div>
    </div>
  );
}

export function AuthModals() {
  const { modalView, closeModals } = useAuth();
  // Track the last non-null view so content doesn't disappear during close animation
  const [lastView, setLastView] = useState(modalView);

  useEffect(() => {
    if (modalView) setLastView(modalView);
  }, [modalView]);

  const isOpen = modalView !== null;
  const activeView = modalView ?? lastView;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) closeModals(); }}
    >
      <DialogContent>
        {activeView === 'signUp' ? <SignUpForm /> : activeView === 'forgotPassword' ? <ForgotPasswordForm /> : <SignInForm />}
      </DialogContent>
    </Dialog>
  );
}
