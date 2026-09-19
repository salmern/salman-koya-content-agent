/**
 * Permission Helpers
 *
 * Pure functions — safe to import in both Client and Server components.
 */

import type { UserRole } from "@/types";

export const CONTENT_CREATOR_ROLES: readonly UserRole[] = ["content_manager", "admin"];

/**
 * Whether a role is allowed to create content requests.
 * Mirrors the RLS policy content_requests_insert (content_manager, admin).
 */
export function canCreateContent(role: UserRole | null | undefined): boolean {
  return role === "content_manager" || role === "admin";
}