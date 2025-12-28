import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Resolves an image URL to an absolute URL using the article's original URL as base.
 * If imageUrl is already absolute, returns as is. If relative, resolves against articleUrl.
 * Returns undefined if imageUrl is falsy.
 */
export function normalizeImageUrl(imageUrl?: string, articleUrl?: string): string {
  if (!imageUrl) return '';
  try {
    // If imageUrl is already absolute, new URL(imageUrl) will succeed
    const url = new URL(imageUrl);
    return url.href;
  } catch {
    // imageUrl is likely relative, try to resolve against articleUrl
    if (articleUrl) {
      try {
        const base = new URL(articleUrl);
        return new URL(imageUrl, base.origin).href;
      } catch {
        // If articleUrl is invalid, fallback to imageUrl as is
        return imageUrl;
      }
    }
    // No base to resolve against, return as is
    return imageUrl;
  }
}
