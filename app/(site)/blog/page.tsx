import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import Section from '@/components/ui/Section';
import { getAllPosts } from '@/lib/blog';
import { pageMetadata } from '@/lib/seo';
import BlogClient from './BlogClient';

export const metadata: Metadata = pageMetadata({
  title: 'Blog — Conseils et actualités',
  description:
    'Conseils pratiques de NEXCLEAN : entretien de la maison et des bureaux, espaces verts, recrutement de personnel et recherche d’emploi.',
  path: '/blog',
});

// [À COMPLÉTER : articles recrutement / emploi — les 8 articles actuels portent sur le nettoyage et le produit]
export default async function BlogPage() {
  const posts = await getAllPosts();
  return (
    <>
      <PageHero
        label="Blog"
        title="Conseils et actualités"
        subtitle="Des conseils concrets pour entretenir vos espaces et réussir vos recrutements."
        breadcrumb={[{ name: 'Blog' }]}
      />
      <Section spacing="sm">
        <BlogClient posts={posts} />
      </Section>
    </>
  );
}

// Revalidation toutes les heures (ISR)
export const revalidate = 3600;
