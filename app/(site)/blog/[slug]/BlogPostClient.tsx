import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import Button from '@/components/ui/Button';
import Section from '@/components/ui/Section';
import { SITE_URL } from '@/lib/seo';
import { BlogPost } from '@/types/blog';

interface BlogPostClientProps {
  post: BlogPost;
}

// Fuseau fixe : la date de l'article ne dépend pas du serveur.
const formatDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });

/** Les articles Markdown répètent leur titre en `# …` : un seul h1 par page, celui de l'en-tête. */
const sansTitreInitial = (html: string) => html.replace(/^\s*<h1>[\s\S]*?<\/h1>\s*/, '');

export default function BlogPostClient({ post }: BlogPostClientProps) {
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;

  const breadcrumbItems = [
    { name: 'Accueil', href: '/' },
    { name: 'Blog', href: '/blog' },
    { name: post.title },
  ];

  const partages = [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}` },
    {
      label: 'Twitter',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(canonicalUrl)}`,
    },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonicalUrl)}` },
  ];

  return (
    <Section spacing="sm" container="narrow">
      <Breadcrumb items={breadcrumbItems} className="mb-3" />

      <Link
        href="/blog"
        className="mb-6 inline-flex min-h-tap items-center gap-2 text-small text-ink-600 transition-colors hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Retour au blog
      </Link>

      <article>
        <header className="mb-8">
          <h1 className="mb-4 font-display text-h2 text-ink-900">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 pb-4 text-small text-muted">
            <time dateTime={post.date}>{formatDate.format(new Date(post.date))}</time>
            <span aria-hidden="true">•</span>
            <span>Par {post.author}</span>
            {post.tags?.map((tag) => (
              <span key={tag} className="rounded-full bg-ink-100 px-2 py-1 text-xs text-ink-700">
                {tag}
              </span>
            ))}
          </div>
        </header>

        {post.coverImage && (
          <div className="relative mb-8 aspect-video overflow-hidden rounded-card bg-ink-100">
            <Image src={post.coverImage} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" priority />
          </div>
        )}

        <div
          className="prose prose-base max-w-none md:prose-lg
            prose-headings:font-display prose-headings:text-ink-900
            prose-h2:text-xl md:prose-h2:text-2xl
            prose-h3:text-lg md:prose-h3:text-xl
            prose-p:text-ink-700 prose-li:text-ink-700 prose-a:text-primary
            prose-a:no-underline hover:prose-a:underline
            prose-strong:text-ink-900 prose-code:text-primary
            prose-code:rounded prose-code:bg-primary-light prose-code:px-1 prose-code:py-0.5
            prose-pre:bg-ink-900 prose-pre:text-ink-100
            prose-img:rounded-2xl prose-img:shadow-card
            prose-blockquote:border-l-4 prose-blockquote:border-primary
            prose-blockquote:pl-4 prose-blockquote:italic
            prose-ul:list-disc prose-ol:list-decimal
            [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:whitespace-nowrap"
          dangerouslySetInnerHTML={{ __html: sansTitreInitial(post.content) }}
        />

        <div className="mt-10 border-t border-ink-100 pt-6">
          <h2 className="mb-3 text-h3 text-ink-900">Partager cet article</h2>
          <div className="flex flex-wrap gap-3">
            {partages.map((p) => (
              <Button key={p.label} href={p.href} variant="outline" size="sm">
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </article>
    </Section>
  );
}
