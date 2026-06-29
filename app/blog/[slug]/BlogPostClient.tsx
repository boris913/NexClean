'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BlogPost } from '@/types/blog';
import { ChevronLeft } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';

interface BlogPostClientProps {
  post: BlogPost;
}

export default function BlogPostClient({ post }: BlogPostClientProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const canonicalUrl = `https://nexclean.xyz/blog/${post.slug}`;
  const coverImage = post.coverImage || '/og-image.png';

  const breadcrumbItems = [
    { name: 'Accueil', href: '/' },
    { name: 'Blog', href: '/blog' },
    { name: post.title },
  ];

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Fil d'Ariane avec taille réduite sur mobile */}
      <div className="text-xs sm:text-sm">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Retour */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-primary mb-8 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Retour au blog
      </Link>

      <article className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 md:p-10">
        {/* Image de couverture */}
        {coverImage && coverImage !== '/og-image.png' && (
          <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden mb-8 relative">
            <Image
              src={coverImage}
              alt={post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* En-tête */}
        <header className="mb-6 md:mb-8">
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-slate-900 mb-3 md:mb-4 leading-tight">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 border-b border-slate-100 pb-3 md:pb-4">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>•</span>
            <span>Par {post.author}</span>
            {post.tags && post.tags.length > 0 && (
              <>
                <span>•</span>
                <div className="flex flex-wrap gap-1">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </header>

        {/* Contenu HTML typographié */}
        <div
          className="prose prose-base md:prose-lg max-w-none 
            prose-headings:font-display prose-headings:text-slate-900 
            prose-headings:text-2xl md:prose-headings:text-3xl 
            prose-h2:text-xl md:prose-h2:text-2xl 
            prose-h3:text-lg md:prose-h3:text-xl 
            prose-p:text-slate-700 prose-a:text-primary 
            prose-a:no-underline hover:prose-a:underline 
            prose-strong:text-slate-900 prose-code:text-primary 
            prose-code:bg-primary-light prose-code:px-1 prose-code:py-0.5 
            prose-code:rounded prose-pre:bg-slate-900 prose-pre:text-slate-100 
            prose-img:rounded-xl prose-img:shadow-lg 
            prose-blockquote:border-l-4 prose-blockquote:border-primary 
            prose-blockquote:pl-4 prose-blockquote:italic 
            prose-ul:list-disc prose-ol:list-decimal
            [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap 
            [&_table]:w-full"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Partage */}
        <div className="mt-10 md:mt-12 pt-6 md:pt-8 border-t border-slate-100">
          <h3 className="text-base md:text-lg font-semibold text-slate-900 mb-3 md:mb-4">
            Partager cet article
          </h3>
          <div className="flex flex-wrap gap-3">
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#1877F2] text-white px-5 py-3 md:px-4 md:py-2 rounded-lg text-sm font-medium hover:bg-[#0e5fc7] transition-colors min-h-[44px] flex items-center justify-center"
            >
              Facebook
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(canonicalUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#1DA1F2] text-white px-5 py-3 md:px-4 md:py-2 rounded-lg text-sm font-medium hover:bg-[#1981c9] transition-colors min-h-[44px] flex items-center justify-center"
            >
              Twitter
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonicalUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#0A66C2] text-white px-5 py-3 md:px-4 md:py-2 rounded-lg text-sm font-medium hover:bg-[#004182] transition-colors min-h-[44px] flex items-center justify-center"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </article>
    </div>
  );
}
