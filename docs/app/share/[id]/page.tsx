// docs/app/share/[id]/page.tsx
// Share viewing page

import { Bot, Calendar, ExternalLink, Lock, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import type { TaskShareSnapshot } from '@/types/share';
import { ShareMessageList } from '@/components/share';
import { SharePasswordForm } from './password-form';

// Enable ISR (Incremental Static Regeneration) with 1 hour revalidation
// This caches the page but revalidates every hour to ensure fresh data
export const revalidate = 3600; // 1 hour
export const dynamicParams = true;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.talkcody.com';

interface SharePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ password?: string }>;
}

async function fetchShare(
  shareId: string,
  password?: string
): Promise<{
  data?: TaskShareSnapshot;
  requiresPassword?: boolean;
  error?: string;
}> {
  try {
    // If password is provided, use POST /verify endpoint for security
    // Password-protected shares should not be cached for security
    if (password) {
      const response = await fetch(`${API_BASE_URL}/api/shares/${shareId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
        cache: 'no-store', // Don't cache password verification
      });

      if (response.status === 401) {
        return { error: 'Invalid password' };
      }

      if (response.status === 404) {
        return { error: 'Share not found' };
      }

      if (response.status === 410) {
        return { error: 'This share has expired' };
      }

      if (!response.ok) {
        return { error: 'Failed to load share' };
      }

      const data = await response.json();
      return { data };
    }

    // Otherwise, use GET endpoint (no password required)
    // Use Next.js ISR caching for public shares (1 hour revalidation)
    console.log('[SharePage] Fetching from:', `${API_BASE_URL}/api/shares/${shareId}`);
    const response = await fetch(`${API_BASE_URL}/api/shares/${shareId}`, {
      next: { 
        revalidate: 3600, // Cache for 1 hour
        tags: [`share-${shareId}`] // Enable on-demand revalidation if needed
      }
    });
    console.log('[SharePage] Response status:', response.status);

    if (response.status === 401) {
      const data = await response.json();
      if (data.requiresPassword) {
        return { requiresPassword: true };
      }
      return { error: 'Invalid password' };
    }

    if (response.status === 404) {
      return { error: 'Share not found' };
    }

    if (response.status === 410) {
      return { error: 'This share has expired' };
    }

    if (!response.ok) {
      return { error: 'Failed to load share' };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('Failed to fetch share:', error);
    return { error: 'Failed to load share' };
  }
}

/**
 * Generate dynamic metadata for SEO and social sharing
 */
export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { id } = await params;
  
  try {
    const result = await fetchShare(id);
    
    if (result.data) {
      const { task, messages, metadata } = result.data;
      const title = `${task.title} | TalkCody Share`;
      const description = `Shared task with ${messages.length} messages · Created with TalkCody AI Coding Assistant`;
      const shareUrl = `https://talkcody.com/share/${id}`;
      
      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: 'article',
          url: shareUrl,
          siteName: 'TalkCody',
          locale: 'en_US',
          images: [
            {
              url: 'https://talkcody.com/og-image.png',
              width: 1200,
              height: 630,
              alt: 'TalkCody - AI Coding Assistant',
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: ['https://talkcody.com/og-image.png'],
          creator: '@talkcody',
        },
        robots: {
          index: true,
          follow: true,
        },
      };
    }
  } catch (error) {
    console.error('Failed to generate metadata:', error);
  }
  
  // Fallback metadata
  return {
    title: 'Shared Task | TalkCody',
    description: 'View a shared task from TalkCody AI Coding Assistant',
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const { id } = await params;
  const { password } = await searchParams;

  const result = await fetchShare(id, password);

  // Show password form if required
  if (result.requiresPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-900 to-black p-8 shadow-2xl shadow-gray-900/50">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-gray-800 to-gray-900 ring-1 ring-gray-700">
              <Lock className="h-6 w-6 text-gray-300" />
            </div>
            <h1 className="text-xl font-semibold text-white">
              Password Protected
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              This conversation is protected. Enter the password to view.
            </p>
          </div>
          <SharePasswordForm shareId={id} />
        </div>
      </div>
    );
  }

  // Show error page
  if (result.error || !result.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-white">
            {result.error === 'Share not found'
              ? 'Share Not Found'
              : result.error === 'This share has expired'
                ? 'Share Expired'
                : 'Error'}
          </h1>
          <p className="mb-6 text-gray-400">
            {result.error || 'Unable to load this shared conversation.'}
          </p>
          <Link
            href="https://talkcody.com"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-2 text-white ring-1 ring-gray-700 transition-all hover:ring-gray-500 hover:shadow-lg hover:shadow-gray-700/50"
          >
            <ExternalLink className="h-4 w-4" />
            Go to TalkCody
          </Link>
        </div>
      </div>
    );
  }

  const snapshot = result.data;

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-800/50 bg-black/80 shadow-lg shadow-gray-900/20 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and title */}
            <div className="flex items-center gap-3">
              <Link
                href="https://talkcody.com"
                className="flex items-center gap-2 text-gray-100 transition-colors hover:text-gray-300"
              >
                <Image
                  src="/logo.svg"
                  alt="TalkCody Logo"
                  width={24}
                  height={24}
                  className="h-6 w-auto invert"
                />
                <span className="font-semibold">TalkCody</span>
              </Link>
              <span className="text-gray-600">/</span>
              <span className="text-sm text-gray-400">
                Shared Task
              </span>
            </div>

            {/* CTA */}
            <Link
              href="https://talkcody.com/docs/introduction/client-downloads"
              className="hidden rounded-lg bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-2 text-sm font-medium text-white ring-1 ring-gray-700 transition-all hover:ring-gray-500 hover:shadow-lg hover:shadow-gray-700/50 sm:inline-flex"
            >
              Try TalkCody Free
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Task info card */}
        <div className="mb-6 rounded-xl border border-gray-700/50 bg-gray-900 p-6 shadow-xl shadow-gray-900/30">
          <h1 className="mb-4 text-2xl font-bold text-white">
            {snapshot.task.title}
          </h1>

          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>Shared {formatDate(snapshot.metadata.sharedAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              <span>{snapshot.messages.length} messages</span>
            </div>
            {snapshot.task.model && (
              <div className="flex items-center gap-1.5">
                <Bot className="h-4 w-4" />
                <span>{snapshot.task.model}</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="overflow-hidden rounded-xl border border-gray-700/50 bg-gray-900 shadow-xl shadow-gray-900/30">
          <ShareMessageList messages={snapshot.messages} />
        </div>

        {/* Footer CTA */}
        <div className="mt-8 rounded-xl border border-gray-700/50 bg-gray-900 p-6 text-center shadow-2xl shadow-gray-900/50 ring-1 ring-gray-800/50">
          <h2 className="mb-4 text-lg font-semibold text-gray-100">
            TalkCody is a Free, Open Source AI Coding Agent.
          </h2>
          <Link
            href="https://talkcody.com/docs/introduction/client-downloads"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-gray-800 to-black px-6 py-3 font-medium text-white ring-1 ring-gray-600 transition-all hover:ring-gray-400 hover:shadow-xl hover:shadow-gray-700/60 hover:scale-105 active:scale-100"
          >
            <ExternalLink className="h-4 w-4" />
            Download TalkCody
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-800/50 py-6">
        <div className="mx-auto max-w-4xl px-4 text-center text-sm text-gray-500">
          <p>
            Powered by{' '}
            <Link
              href="https://talkcody.com"
              className="text-gray-300 hover:text-white hover:underline"
            >
              TalkCody
            </Link>
            {' '}— AI Coding Agent
          </p>
        </div>
      </footer>
    </div>
  );
}
