import { Badge } from '@components/ui/badge';

export const NewsletterHeader = () => {
  return (
    <header className="mb-12">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-brand-accent rounded-lg"></div>
          <h1 className="text-3xl font-bold text-text-headline">TechPulse</h1>
          <Badge variant="secondary" className="bg-brand-accent/10 text-brand-accent border-brand-accent/20">
            Newsletter
          </Badge>
        </div>
        <p className="text-text-body text-lg max-w-2xl">
          The latest breakthroughs in technology, science, and innovation. Curated insights from the world's leading
          research institutions and tech companies.
        </p>
      </div>
    </header>
  );
};
