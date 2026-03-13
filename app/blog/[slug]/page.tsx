import { notFound } from 'next/navigation';
import { getPostBySlug, getAllPostSlugs } from '@/lib/blog';
import BlogPostClient from './BlogPostClient';
import { Metadata } from 'next';

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

  if (!post) {
    return {
      title: 'Article non trouvé | NexClean',
    };
  }

  const coverImage = post.coverImage
    ? `https://nexclean.xyz${post.coverImage}`
    : 'https://nexclean.xyz/og-image.png';

  return {
    title: `${post.title} | Blog NexClean`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://nexclean.xyz/blog/${slug}`,
      images: [{ url: coverImage, width: 1200, height: 630, alt: post.title }],
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [coverImage],
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  return <BlogPostClient post={post} />;
}

export const revalidate = 3600;