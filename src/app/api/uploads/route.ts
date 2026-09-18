/**
 * File Upload & Text Extraction API
 *
 * Accepts PDF, DOCX, DOC, TXT, MD files.
 * Extracts text content and returns it for use as supporting material.
 * Files are stored in Supabase Storage for audit purposes.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { toApiError, getStatusCode, ValidationError } from "@/lib/errors";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);
const ALLOWED_EXTENSIONS = /\.(pdf|docx|doc|txt|md|markdown)$/i;

export async function POST(req: Request) {
  try {
    await requireAuth();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new ValidationError("No file provided");
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(
        `File too large. Maximum size is 10 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`
      );
    }

    // Validate type by both MIME and extension
    const hasValidMime = ALLOWED_TYPES.has(file.type);
    const hasValidExt = ALLOWED_EXTENSIONS.test(file.name);

    if (!hasValidMime && !hasValidExt) {
      throw new ValidationError(
        `File type not supported. Allowed: PDF, DOCX, DOC, TXT, Markdown.`
      );
    }

    // Extract text based on type
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let extractedText = "";
    let extractionMethod = "unknown";

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isPdf = ext === "pdf" || file.type === "application/pdf";
    const isDocx =
      ext === "docx" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isDoc = ext === "doc" || file.type === "application/msword";
    const isText = ext === "txt" || ext === "md" || ext === "markdown" || file.type.startsWith("text/");

    if (isPdf) {
      try {
        // pdf-parse CommonJS compatibility
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse");
        const result = await pdfParse(buffer);
        extractedText = result.text?.trim() ?? "";
        extractionMethod = "pdf-parse";
      } catch (err) {
        console.error("[FileUpload] PDF extraction failed:", err);
        throw new ValidationError(
          "Could not extract text from this PDF. The file may be scanned, password-protected, or corrupted."
        );
      }
    } else if (isDocx) {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value?.trim() ?? "";
        extractionMethod = "mammoth";
      } catch (err) {
        console.error("[FileUpload] DOCX extraction failed:", err);
        throw new ValidationError(
          "Could not extract text from this Word document. The file may be corrupted or in an unsupported format."
        );
      }
    } else if (isDoc) {
      throw new ValidationError(
        "Legacy .doc files are not supported. Please convert to .docx or .txt and try again."
      );
    } else if (isText) {
      extractedText = new TextDecoder("utf-8").decode(buffer).trim();
      extractionMethod = "text";
    } else {
      throw new ValidationError("File type could not be determined. Please use PDF, DOCX, or TXT.");
    }

    if (!extractedText || extractedText.length < 10) {
      throw new ValidationError(
        "No readable text could be extracted from this file. The file may be empty, scanned, or image-based."
      );
    }

    // Truncate to 50k chars (schema limit)
    const truncated = extractedText.length > 50000;
    const text = truncated ? extractedText.slice(0, 50000) : extractedText;
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      text,
      wordCount,
      truncated,
      fileName: file.name,
      fileSize: file.size,
      extractionMethod,
      characterCount: text.length,
    });
  } catch (error) {
    return NextResponse.json(toApiError(error), { status: getStatusCode(error) });
  }
}
