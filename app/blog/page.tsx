import { getAllPosts } from '@/lib/blog';
import BlogClient from './BlogClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog — Conseils et actualités | NexClean Douala',
  description:
    'Retrouvez tous nos articles sur le nettoyage professionnel, les bonnes pratiques, et les actualités de NexClean à Douala.',
};

export default async function BlogPage() {
  const posts = await getAllPosts();
  return <BlogClient posts={posts} />;
}

// Revalidation toutes les heures (ISR)
export const revalidate = 3600;