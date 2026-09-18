/**
 * Supabase Database Types
 *
 * Auto-generated types would normally come from `supabase gen types typescript`.
 * This file provides hand-crafted types that match our migration schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: "content_manager" | "reviewer" | "admin";
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: "content_manager" | "reviewer" | "admin";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          role?: "content_manager" | "reviewer" | "admin";
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      content_requests: {
        Row: {
          id: string;
          user_id: string;
          content_idea: string;
          target_audience: string;
          primary_keyword: string | null;
          content_goal: string | null;
          source_url: string | null;
          supporting_material: string | null;
          tone: string | null;
          additional_instructions: string | null;
          requested_channels: string[];
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["content_requests"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["content_requests"]["Row"],
            "id" | "user_id" | "created_at"
          >
        >;
      };
      research_runs: {
        Row: {
          id: string;
          content_request_id: string;
          status: string;
          error_message: string | null;
          source_count: number;
          selected_source_count: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["research_runs"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["research_runs"]["Row"],
            "id" | "content_request_id" | "created_at"
          >
        >;
      };
      content_sources: {
        Row: {
          id: string;
          research_run_id: string;
          content_request_id: string;
          url: string;
          title: string | null;
          domain: string | null;
          author: string | null;
          published_at: string | null;
          retrieved_at: string | null;
          content: string | null;
          summary: string | null;
          relevance_score: number | null;
          selected: boolean;
          selection_reason: string | null;
          retrieval_status: string;
          content_hash: string | null;
          word_count: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["content_sources"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["content_sources"]["Row"],
            "id" | "content_request_id" | "created_at"
          >
        >;
      };
      content_plans: {
        Row: {
          id: string;
          content_request_id: string;
          working_title: string;
          primary_keyword: string;
          secondary_keywords: string[];
          search_intent: string;
          target_audience: string;
          content_goal: string;
          outline: Json;
          key_points: string[];
          source_mapping: Json;
          recommended_links: Json;
          recommended_image_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["content_plans"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["content_plans"]["Row"],
            "id" | "content_request_id" | "created_at"
          >
        >;
      };
      content_drafts: {
        Row: {
          id: string;
          content_request_id: string;
          content_plan_id: string | null;
          version_number: number;
          parent_version_id: string | null;
          title: string;
          summary: string;
          article: string;
          primary_keyword: string;
          secondary_keywords: string[];
          source_ids: string[];
          key_claims: Json;
          word_count: number;
          reading_time_minutes: number;
          change_summary: string | null;
          created_by: string;
          created_by_user_id: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["content_drafts"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: never; // Drafts are immutable — no updates allowed
      };
      draft_evaluations: {
        Row: {
          id: string;
          draft_id: string;
          content_request_id: string;
          overall_status: string;
          scores: Json;
          unsupported_claims: Json;
          weak_sections: Json;
          recommended_changes: string[];
          summary: string;
          model: string;
          input_tokens: number | null;
          output_tokens: number | null;
          estimated_cost_usd: number | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["draft_evaluations"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: never; // Evaluations are immutable
      };
      draft_revisions: {
        Row: {
          id: string;
          original_draft_id: string;
          revised_draft_id: string;
          content_request_id: string;
          revision_number: number;
          changes_made: string[];
          revision_reason: string;
          model: string;
          input_tokens: number | null;
          output_tokens: number | null;
          estimated_cost_usd: number | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["draft_revisions"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: never;
      };
      human_reviews: {
        Row: {
          id: string;
          content_request_id: string;
          draft_id: string;
          draft_version: number;
          reviewer_id: string;
          decision: string;
          feedback: string | null;
          revision_instructions: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["human_reviews"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: never; // Reviews are immutable
      };
      channel_content: {
        Row: {
          id: string;
          content_request_id: string;
          approved_draft_id: string;
          channel: string;
          title: string | null;
          subject_line: string | null;
          content: string;
          hashtags: string[];
          cta: string | null;
          word_count: number;
          character_count: number;
          validation_status: string;
          validation_errors: Json;
          generation_model: string | null;
          revision_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["channel_content"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["channel_content"]["Row"],
            "id" | "content_request_id" | "approved_draft_id" | "created_at"
          >
        >;
      };
      publishing_queue: {
        Row: {
          id: string;
          content_request_id: string;
          channel_content_id: string;
          channel: string;
          approved_draft_id: string;
          approved_version: number;
          idempotency_key: string;
          status: string;
          scheduled_at: string | null;
          published_at: string | null;
          error_message: string | null;
          retry_count: number;
          provider: string;
          provider_post_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["publishing_queue"]["Row"],
          "id" | "created_at" | "updated_at"
        > & { id?: string };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["publishing_queue"]["Row"],
            "id" | "content_request_id" | "idempotency_key" | "created_at"
          >
        >;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_email: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          content_request_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["audit_logs"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: never; // Audit logs are immutable
      };
      workflow_runs: {
        Row: {
          id: string;
          content_request_id: string;
          operation: string;
          status: string;
          started_at: string;
          completed_at: string | null;
          duration_ms: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["workflow_runs"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: Partial<
          Omit<
            Database["public"]["Tables"]["workflow_runs"]["Row"],
            "id" | "content_request_id" | "created_at"
          >
        >;
      };
      failure_events: {
        Row: {
          id: string;
          workflow_run_id: string | null;
          content_request_id: string | null;
          operation: string;
          error_type: string;
          message: string;
          stack_trace: string | null;
          retry_count: number;
          max_retries: number;
          is_retryable: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["failure_events"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: Partial<
          Pick<
            Database["public"]["Tables"]["failure_events"]["Row"],
            "retry_count"
          >
        >;
      };
      ai_usage: {
        Row: {
          id: string;
          content_request_id: string | null;
          operation: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          estimated_cost_usd: number;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["ai_usage"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: "content_manager" | "reviewer" | "admin";
    };
  };
}
