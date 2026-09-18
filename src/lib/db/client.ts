/**
 * Supabase Server Client Factory
 *
 * SERVER-ONLY — safe to import in Server Components, API routes, services.
 * Contains next/headers import — do NOT import in Client Components.
 *
 * For Client Components, import from @/lib/db/browser-client instead.
 *
 * SECURITY: Service role key is never exposed to the browser.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

// Re-export browser client for convenience in server files
export { createSupabaseBrowserClient } from "./browser-client";

// ---- Server Client (uses session cookie, respects RLS) ------

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // read-only context — safe to ignore
          }
        },
      },
    }
  );
}

// ---- Admin Client (service role, bypasses RLS) --------------
// SERVER-SIDE ONLY. Never import in client components.

export function createSupabaseAdminClient(): ReturnType<typeof createClient> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
