import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/client";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Handle error params Supabase sends back (e.g. otp_expired, access_denied)
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  if (errorCode) {
    const messages: Record<string, string> = {
      otp_expired:
        "Your confirmation link has expired. Please sign up again to receive a new one.",
      access_denied: "Access was denied. Please try signing in again.",
    };
    const message = messages[errorCode] ?? errorDescription ?? "Something went wrong.";
    const url = new URL(`${origin}/login`);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url.toString());
  }

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const url = new URL(`${origin}/login`);
  url.searchParams.set(
    "error",
    "Confirmation failed. Please try signing in or sign up again."
  );
  return NextResponse.redirect(url.toString());
}
