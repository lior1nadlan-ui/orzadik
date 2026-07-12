import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface Article {
  id: string;
  slug: string;
  title_he: string;
  description: string;
  body_html: string;
  featured_image?: string;
  author: string;
  category_id?: string;
  published_at: string;
  read_time_minutes: number;
  seo_keywords?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// Fetch all published articles with retry logic
async function fetchArticlesWithRetry(maxRetries = 2): Promise<Article[]> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const { data, error } = await supabaseAdmin
        .from("articles")
        .select("*")
        .eq("is_published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data as Article[]) || [];
    } catch (err: any) {
      if (i === maxRetries || !["ECONNREFUSED", "ETIMEDOUT", "network"].some(m => String(err).includes(m))) {
        return [];
      }
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 100));
    }
  }
  return [];
}

// Fetch single article by slug with retry logic
async function fetchArticleWithRetry(slug: string, maxRetries = 2): Promise<Article | null> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const { data, error } = await supabaseAdmin
        .from("articles")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return (data as Article) || null;
    } catch (err: any) {
      if (i === maxRetries || !["ECONNREFUSED", "ETIMEDOUT", "network"].some(m => String(err).includes(m))) {
        return null;
      }
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 100));
    }
  }
  return null;
}

// Fetch articles by category
async function fetchArticlesByCategoryWithRetry(
  categoryId: string,
  maxRetries = 2,
  limit = 3,
): Promise<Article[]> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const { data, error } = await supabaseAdmin
        .from("articles")
        .select("*")
        .eq("category_id", categoryId)
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as Article[]) || [];
    } catch (err: any) {
      if (i === maxRetries || !["ECONNREFUSED", "ETIMEDOUT", "network"].some(m => String(err).includes(m))) {
        return [];
      }
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 100));
    }
  }
  return [];
}

export {
  fetchArticlesWithRetry,
  fetchArticleWithRetry,
  fetchArticlesByCategoryWithRetry,
};
