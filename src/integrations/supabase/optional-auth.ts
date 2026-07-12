// Resolves the authenticated user id from the request JWT if present.
// Returns null for guest callers. Never trusts client-supplied identities.
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export async function getOptionalUserId(): Promise<string | null> {
  const info = await getOptionalAuthInfo();
  return info?.userId ?? null;
}

export async function getOptionalAuthInfo(): Promise<{ userId: string; email: string | null } | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  const request = getRequest();
  const authHeader = request?.headers?.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);
  if (!token) return null;
  try {
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    const claims = data.claims as Record<string, unknown>;
    const email = typeof claims.email === 'string' ? (claims.email as string) : null;
    return { userId: claims.sub as string, email };
  } catch {
    return null;
  }
}
