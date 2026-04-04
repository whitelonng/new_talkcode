// docs/app/share/[id]/password-form.tsx
// Client-side password form for protected shares

'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SharePasswordFormProps {
  shareId: string;
}

export function SharePasswordForm({ shareId }: SharePasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Redirect with password as query param
    // The page will re-fetch with the password
    router.push(`/share/${shareId}?password=${encodeURIComponent(password)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          autoFocus
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Verifying...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            View Task
          </>
        )}
      </button>
    </form>
  );
}
