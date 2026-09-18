"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Send, Paperclip, X, AlertCircle,
  Loader2, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { ContentChannel, ContentTone } from "@/types";
import { cn } from "@/lib/utils";

const CHANNEL_OPTIONS: { value: ContentChannel; label: string; description: string }[] = [
  { value: "article", label: "Article", description: "Long-form blog post" },
  { value: "linkedin", label: "LinkedIn", description: "Professional post" },
  { value: "x", label: "X (Twitter)", description: "Short post or thread" },
  { value: "newsletter", label: "Newsletter", description: "Email newsletter" },
];

const TONE_OPTIONS: { value: ContentTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "authoritative", label: "Authoritative" },
  { value: "friendly", label: "Friendly" },
  { value: "educational", label: "Educational" },
  { value: "persuasive", label: "Persuasive" },
];

const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt,.md,.markdown";
const MAX_FILE_MB = 10;

interface UploadedFile {
  name: string;
  size: number;
  text: string;
  wordCount: number;
  truncated: boolean;
}

export function NewContentForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [formData, setFormData] = useState({
    content_idea: "",
    target_audience: "",
    primary_keyword: "",
    content_goal: "",
    source_url: "",
    supporting_material: "",
    tone: "" as ContentTone | "",
    additional_instructions: "",
    requested_channels: ["article"] as ContentChannel[],
  });

  function toggleChannel(channel: ContentChannel) {
    setFormData((prev) => ({
      ...prev,
      requested_channels: prev.requested_channels.includes(channel)
        ? prev.requested_channels.filter((c) => c !== channel)
        : [...prev.requested_channels, channel],
    }));
  }

  async function handleFileUpload(file: File) {
    if (!file) return;

    // Client-side size check
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`File too large`, {
        description: `Maximum file size is ${MAX_FILE_MB} MB. This file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      });
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("Upload failed", { description: data.error?.message ?? "Could not extract text from file." });
        return;
      }

      setUploadedFile({
        name: data.fileName,
        size: file.size,
        text: data.text,
        wordCount: data.wordCount,
        truncated: data.truncated,
      });

      // Merge extracted text with any existing pasted material
      setFormData((prev) => ({
        ...prev,
        supporting_material: [prev.supporting_material.trim(), data.text]
          .filter(Boolean)
          .join("\n\n---\n\n"),
      }));

      toast.success(`File processed`, {
        description: `${data.wordCount.toLocaleString()} words extracted from ${file.name}${data.truncated ? " (truncated to 50k chars)" : ""}.`,
      });
    } catch {
      toast.error("Upload failed", { description: "Network error. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    // Reset input so the same file can be re-uploaded
    e.target.value = "";
  }

  function removeUploadedFile() {
    if (!uploadedFile) return;
    // Remove the extracted text from supporting_material
    setFormData((prev) => ({
      ...prev,
      supporting_material: prev.supporting_material
        .replace(`\n\n---\n\n${uploadedFile.text}`, "")
        .replace(uploadedFile.text, "")
        .trim(),
    }));
    setUploadedFile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formData.content_idea.trim() || formData.content_idea.length < 10) {
      setError("Content idea must be at least 10 characters.");
      return;
    }
    if (!formData.target_audience.trim() || formData.target_audience.length < 5) {
      setError("Target audience must be at least 5 characters.");
      return;
    }
    if (formData.requested_channels.length === 0) {
      setError("Select at least one channel.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          tone: formData.tone || null,
          primary_keyword: formData.primary_keyword || null,
          content_goal: formData.content_goal || null,
          source_url: formData.source_url || null,
          supporting_material: formData.supporting_material || null,
          additional_instructions: formData.additional_instructions || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Failed to create content request.");
        return;
      }

      toast.success("Content request created", {
        description: "Research is starting — this runs in the background.",
      });
      router.push(`/content/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full h-8 px-3 rounded-md border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 transition-shadow";
  const textareaCls =
    "w-full px-3 py-2 rounded-md border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 resize-none transition-shadow";
  const labelCls = "block text-[13px] font-medium text-foreground mb-1.5";
  const hintCls = "text-[11px] text-muted-foreground mt-1";
  const sectionCls = "bg-card rounded-lg border border-border p-5 space-y-4";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="error">
          <span className="flex items-center gap-1.5">
            <AlertCircle size={13} className="flex-shrink-0" />
            {error}
          </span>
        </Alert>
      )}

      {/* ── Required ───────────────────────────────────────── */}
      <section className={sectionCls}>
        <div className="pb-1 border-b border-border">
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Required
          </h2>
        </div>

        <div>
          <label htmlFor="content_idea" className={labelCls}>
            Content Idea <span className="text-destructive">*</span>
          </label>
          <textarea
            id="content_idea"
            required
            minLength={10}
            maxLength={500}
            rows={3}
            value={formData.content_idea}
            onChange={(e) => setFormData((p) => ({ ...p, content_idea: e.target.value }))}
            className={textareaCls}
            placeholder="e.g. How AI is changing recruitment practices in 2026"
          />
          <p className={hintCls}>{formData.content_idea.length}/500</p>
        </div>

        <div>
          <label htmlFor="target_audience" className={labelCls}>
            Target Audience <span className="text-destructive">*</span>
          </label>
          <input
            id="target_audience"
            type="text"
            required
            minLength={5}
            maxLength={300}
            value={formData.target_audience}
            onChange={(e) => setFormData((p) => ({ ...p, target_audience: e.target.value }))}
            className={inputCls}
            placeholder="e.g. HR managers at growth-stage companies"
          />
        </div>

        <div>
          <label className={labelCls}>
            Channels <span className="text-destructive">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CHANNEL_OPTIONS.map((ch) => {
              const checked = formData.requested_channels.includes(ch.value);
              return (
                <label
                  key={ch.value}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors",
                    checked
                      ? "border-primary bg-[hsl(var(--info-subtle))]"
                      : "border-border hover:bg-secondary"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleChannel(ch.value)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="text-[13px] font-medium text-foreground leading-tight">{ch.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{ch.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Optional ───────────────────────────────────────── */}
      <section className={sectionCls}>
        <div className="pb-1 border-b border-border">
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Optional — improves output quality
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="primary_keyword" className={labelCls}>Primary Keyword</label>
            <input
              id="primary_keyword"
              type="text"
              maxLength={100}
              value={formData.primary_keyword}
              onChange={(e) => setFormData((p) => ({ ...p, primary_keyword: e.target.value }))}
              className={inputCls}
              placeholder="e.g. AI recruitment"
            />
          </div>
          <div>
            <label htmlFor="tone" className={labelCls}>Tone</label>
            <select
              id="tone"
              value={formData.tone}
              onChange={(e) => setFormData((p) => ({ ...p, tone: e.target.value as ContentTone | "" }))}
              className={cn(inputCls, "h-8 bg-background")}
            >
              <option value="">Select tone…</option>
              {TONE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="content_goal" className={labelCls}>Content Goal</label>
          <input
            id="content_goal"
            type="text"
            maxLength={500}
            value={formData.content_goal}
            onChange={(e) => setFormData((p) => ({ ...p, content_goal: e.target.value }))}
            className={inputCls}
            placeholder="e.g. Educate HR teams and generate demo requests"
          />
        </div>

        <div>
          <label htmlFor="source_url" className={labelCls}>Source URL</label>
          <input
            id="source_url"
            type="url"
            maxLength={2048}
            value={formData.source_url}
            onChange={(e) => setFormData((p) => ({ ...p, source_url: e.target.value }))}
            className={inputCls}
            placeholder="https://example.com/article"
          />
          <p className={hintCls}>We&apos;ll retrieve and analyse this URL as a research source.</p>
        </div>

        {/* Supporting material — text + file upload */}
        <div>
          <label htmlFor="supporting_material" className={labelCls}>
            Supporting Material
          </label>

          {/* Uploaded file pill */}
          {uploadedFile && (
            <div className="flex items-center gap-2 mb-2 p-2.5 rounded-md bg-[hsl(var(--success-subtle))] border border-[hsl(var(--success-border))]">
              <CheckCircle2 size={13} className="text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-foreground truncate">{uploadedFile.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {uploadedFile.wordCount.toLocaleString()} words extracted
                  {uploadedFile.truncated && " (truncated to 50k chars)"}
                </p>
              </div>
              <button
                type="button"
                onClick={removeUploadedFile}
                className="p-1 rounded hover:bg-secondary transition-colors flex-shrink-0"
                aria-label="Remove file"
              >
                <X size={12} className="text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            className={cn(
              "mb-2 flex items-center justify-between gap-3 rounded-md border-2 border-dashed px-3 py-2.5 transition-colors cursor-pointer",
              dragOver
                ? "border-primary bg-[hsl(var(--info-subtle))]"
                : "border-border hover:border-primary/40 hover:bg-secondary/50"
            )}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label="Upload file"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          >
            <div className="flex items-center gap-2">
              {uploading ? (
                <Loader2 size={14} className="animate-spin text-primary" />
              ) : (
                <Paperclip size={14} className="text-muted-foreground" />
              )}
              <span className="text-[12px] text-muted-foreground">
                {uploading
                  ? "Extracting text…"
                  : dragOver
                    ? "Drop to upload"
                    : "Upload file — PDF, DOCX, TXT, Markdown"}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground/60 flex-shrink-0">
              Max {MAX_FILE_MB} MB
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileInputChange}
            className="sr-only"
            aria-hidden="true"
          />

          <textarea
            id="supporting_material"
            maxLength={50000}
            rows={4}
            value={formData.supporting_material}
            onChange={(e) => setFormData((p) => ({ ...p, supporting_material: e.target.value }))}
            className={textareaCls}
            placeholder="Paste relevant text, data, bullet points, or context here…"
          />
          <p className={hintCls}>{formData.supporting_material.length.toLocaleString()}/50,000 chars</p>
        </div>

        <div>
          <label htmlFor="additional_instructions" className={labelCls}>
            Additional Instructions
          </label>
          <textarea
            id="additional_instructions"
            maxLength={1000}
            rows={2}
            value={formData.additional_instructions}
            onChange={(e) => setFormData((p) => ({ ...p, additional_instructions: e.target.value }))}
            className={textareaCls}
            placeholder="Specific requirements, things to avoid, formatting preferences…"
          />
        </div>
      </section>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" loading={loading} disabled={uploading}>
          <Send size={13} />
          {loading ? "Creating…" : "Create Content Request"}
        </Button>
      </div>
    </form>
  );
}
