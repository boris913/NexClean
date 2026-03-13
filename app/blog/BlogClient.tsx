'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BlogPostMetadata } from '@/types/blog';

interface BlogClientProps {
  posts: BlogPostMetadata[];
}

export default function BlogClient({ posts }: BlogClientProps) {
  const [visiblePosts, setVisiblePosts] = useState<BlogPostMetadata[]>([]);
  const [displayCount, setDisplayCount] = useState(9);

  useEffect(() => {
    setVisiblePosts(posts.slice(0, displayCount));
  }, [posts, displayCount]);

  const loadMore = () => setDisplayCount((prev) => prev + 9);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* En-tête */}
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl sm:text-5xl text-slate-900 mb-4">
          Blog NexClean
        </h1>
        <div className="w-20 h-1 bg-primary mx-auto mb-4 rounded-full" />
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Conseils, guides et actualités pour un intérieur toujours impeccable.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 bg-white/80 rounded-2xl border border-slate-100">
          <p className="text-slate-500">Aucun article pour le moment.</p>
          <p className="text-sm text-slate-400 mt-2">Revenez bientôt !</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {visiblePosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden hover:shadow-card-hover transition-all duration-300"
              >
                <div className="aspect-video bg-slate-100 relative overflow-hidden">
                  {post.coverImage ? (
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                      <span className="text-primary text-4xl">N</span>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                    <span>•</span>
                    <span>{post.author}</span>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-slate-600 line-clamp-3">{post.description}</p>
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {post.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {post.tags.length > 2 && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                          +{post.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {visiblePosts.length < posts.length && (
            <div className="text-center mt-12">
              <button
                onClick={loadMore}
                className="bg-primary text-white font-medium px-8 py-3 rounded-full hover:bg-primary-dark transition-colors shadow-btn hover:shadow-btn-hover"
              >
                Voir plus d'articles
              </button>
              <p className="text-sm text-slate-400 mt-3">
                {visiblePosts.length} sur {posts.length} articles
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}