import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CTASection from '@/components/sections/CTASection';
import { CTA_FINAL } from '@/content/home-data';
import { getPostBySlug, getAllPostSlugs } from '@/lib/blog';
import { SITE_URL, pageMetadata } from '@/lib/seo';
import BlogPostClient from './BlogPostClient';

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) return { title: 'Article non trouvé' };

  // Sans image de couverture, pageMetadata se replie sur OG_IMAGE.
  const base = pageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${slug}`,
    image: post.coverImage || undefined,
  });

  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      ...(post.coverImage ? { images: [{ url: `${SITE_URL}${post.coverImage}`, alt: post.title }] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  return (
    <>
      <BlogPostClient post={post} />
      <CTASection
        title={CTA_FINAL.titre}
        subtitle={CTA_FINAL.texte}
        formLabel={CTA_FINAL.cta.label}
        formHref={CTA_FINAL.cta.href}
        whatsappLabel={CTA_FINAL.whatsapp.label}
        whatsappMessage={CTA_FINAL.whatsapp.message}
      />
    </>
  );
}

export const revalidate = 3600;
