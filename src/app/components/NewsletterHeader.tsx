import { Badge } from './ui/badge';
import type { INewsletter } from '@lib/models/types';
import { Calendar } from 'lucide-react';
import { formatDate } from './utils';

// Make process accessible in browser
// eslint-disable-next-line no-var
var process;
const devEnv = process?.env.NODE_ENV !== 'production';

interface NewsletterHeaderProps {
  newsletter?: {
    _id?: string;
    name?: string;
    date?: string;
  };
}

export const NewsletterHeader = ({ newsletter }: NewsletterHeaderProps) => {
  return (
    <header className="mb-12 overflow-x-hidden">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-accent rounded-lg"></div>
          <h1 className="text-3xl font-bold text-text-headline">{newsletter?.name || 'Other Newsletters'}</h1>
          <Badge variant="secondary" className="bg-brand-accent/10 text-brand-accent border-brand-accent/20">
            Newsletter
          </Badge>
        </div>
        {newsletter?.date && (
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(newsletter?.date)}</span>
            {devEnv && <div className="ml-auto text-xs text-muted-foreground">{newsletter?._id}</div>}
          </div>
        )}
        {/* <div className="text-text-body text-lg max-w-2xl">
          {newsletter?.content && newsletter?.content.trim() ? (
            <pre>{newsletter?.content}</pre>
          ) : (
            "The latest breakthroughs in technology, science, and innovation. Curated insights from the world's leading research institutions and tech companies."
          )}
        </div> */}
      </div>
    </header>
  );
};
