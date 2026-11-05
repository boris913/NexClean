'use client';

import { useState } from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { BlogPostMetadata } from '@/types/blog';

interface BlogClientProps {
  posts: BlogPostMetadata[];
}

const PAR_PAGE = 9;

// Fuseau fixe : le serveur et le navigateur doivent afficher le même jour (hydratation).
const formatDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });

/** Liste rendue dès le HTML serveur ; « Voir plus » reste géré côté client. */
export default function BlogClient({ posts }: BlogClientProps) {
  const [displayCount, setDisplayCount] = useState(PAR_PAGE);
  const visiblePosts = posts.slice(0, displayCount);

  if (posts.length === 0) {
    return (
      <div className="rounded-card border border-ink-100 py-16 text-center">
        <p className="text-muted">Aucun article pour le moment.</p>
        <p className="mt-2 text-small text-muted">Revenez bientôt !</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visiblePosts.map((post) => (
          <Card key={post.slug} variant="interactive" href={`/blog/${post.slug}`} className="overflow-hidden !p-0">
            <div className="relative aspect-video overflow-hidden bg-ink-100">
              {post.coverImage ? (
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand-50">
                  <span className="font-display text-4xl text-primary">N</span>
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="mb-3 flex flex-wrap items-center gap-2 text-small text-muted">
                <time dateTime={post.date}>{formatDate.format(new Date(post.date))}</time>
                <span aria-hidden="true">•</span>
                <span>{post.author}</span>
              </p>
              <h2 className="mb-3 line-clamp-2 text-h3 text-ink-900 transition-colors group-hover:text-primary">{post.title}</h2>
              <p className="line-clamp-3 text-small text-ink-600">{post.description}</p>
              {post.tags && post.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {post.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="rounded-full bg-ink-100 px-3 py-1 text-xs text-ink-600">
                      {tag}
                    </span>
                  ))}
                  {post.tags.length > 2 && (
                    <span className="rounded-full bg-ink-100 px-3 py-1 text-xs text-ink-600">+{post.tags.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {visiblePosts.length < posts.length && (
        <div className="mt-12 text-center">
          <Button variant="secondary" onClick={() => setDisplayCount((prev) => prev + PAR_PAGE)}>
            Voir plus d&apos;articles
          </Button>
          <p className="mt-3 text-small text-muted">
            {visiblePosts.length} sur {posts.length} articles
          </p>
        </div>
      )}
    </>
  );
}
