import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import remarkGfm from 'remark-gfm';
import { BlogPost, BlogPostMetadata } from '@/types/blog';

const postsDirectory = path.join(process.cwd(), 'content/blog');

export async function getAllPosts(): Promise<BlogPostMetadata[]> {
  if (!fs.existsSync(postsDirectory)) {
    fs.mkdirSync(postsDirectory, { recursive: true });
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  const allPostsData = fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, '');
      const fullPath = path.join(postsDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');
      const { data } = matter(fileContents);

      return {
        slug,
        title: data.title || 'Sans titre',
        description: data.description || '',
        date: data.date || new Date().toISOString(),
        author: data.author || 'NexClean',
        tags: data.tags || [],
        coverImage: data.coverImage || '',
        isPublished: data.isPublished !== undefined ? data.isPublished : false,
      } as BlogPostMetadata;
    })
    .filter((post) => post.isPublished);

  // Tri du plus récent au plus ancien
  return allPostsData.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.md`);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    const isPublished = data.isPublished !== false;

    if (process.env.NODE_ENV === 'production' && !isPublished) {
      return null;
    }

    // Conversion du markdown en HTML
    let contentHtml = '';
    try {
      const processedContent = await remark()
        .use(remarkGfm)
        .use(html, { sanitize: false })
        .process(content);
      contentHtml = processedContent.toString();
    } catch (error) {
      console.error(`Erreur lors de la conversion du markdown pour ${slug}:`, error);
      contentHtml = '<p>Erreur lors du rendu du contenu.</p>';
    }

    return {
      slug,
      title: data.title || 'Sans titre',
      description: data.description || '',
      date: data.date || new Date().toISOString(),
      author: data.author || 'NexClean',
      tags: data.tags || [],
      coverImage: data.coverImage || '',
      content: contentHtml,
      isPublished,
    };
  } catch (error) {
    console.error(`Error loading post ${slug}:`, error);
    return null;
  }
}

export async function getAllPostSlugs(): Promise<string[]> {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  return fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => fileName.replace(/\.md$/, ''));
}