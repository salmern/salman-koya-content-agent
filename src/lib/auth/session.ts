/**
 * Auth Session Helpers (Server-Side)
 *
 * These functions are safe to use in API routes and Server Components.
 * They never expose sensitive data to the client.
 */

import { createSupabaseServerClient } from "@/lib/db/client";
import { AuthError, ForbiddenError } from "@/lib/errors";
import type { Profile, UserRole } from "@/types";

export interface AuthSession {
  userId: string;
  email: string;
  profile: Profile;
}

/**
 * Get the current authenticated session.
 * Throws AuthError if not authenticated.
 */
export async function requireAuth(): Promise<AuthSession> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError("You must be signed in to perform this action.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new AuthError("User profile not found. Please sign in again.");
  }

  return {
    userId: user.id,
    email: user.email!,
    profile: profile as Profile,
  };
}

/**
 * Require a specific role or set of roles.
 * Throws ForbiddenError if the user doesn't have the required role.
 */
export async function requireRole(roles: UserRole | UserRole[]): Promise<AuthSession> {
  const session = await requireAuth();
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(session.profile.role)) {
    throw new ForbiddenError(
      `This action requires one of the following roles: ${allowedRoles.join(", ")}. Your role is: ${session.profile.role}.`
    );
  }

  return session;
}

/**
 * Get the current session without throwing.
 * Returns null if not authenticated.
 */
export async function getOptionalSession(): Promise<AuthSession | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}

/**
 * Check whether a user can review a content request.
 * Enforces separation of duties if configured.
 */
export function canReview(session: AuthSession, contentRequestUserId: string): boolean {
  if (session.profile.role !== "reviewer" && session.profile.role !== "admin") {
    return false;
  }

  const enforceSOD = process.env.ENFORCE_SEPARATION_OF_DUTIES !== "false";
  if (enforceSOD && session.userId === contentRequestUserId) {
    return false; // Cannot review own content
  }

  return true;
}

/**
 * Check whether the user owns the content request (or is admin).
 */
export function canManageRequest(session: AuthSession, contentRequestUserId: string): boolean {
  return session.userId === contentRequestUserId || session.profile.role === "admin";
}
