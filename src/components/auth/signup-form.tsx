"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/db/browser-client";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 transition-shadow";

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !fullName) return;
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        toast.error("Sign up failed", { description: error.message });
      } else {
        toast.success("Account created", {
          description: "Check your email to confirm your account, then sign in.",
        });
        router.push("/login?success=Account+created.+Check+your+email+to+confirm.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm p-6">
      <div className="mb-5">
        <h1 className="text-[15px] font-semibold text-foreground">Create account</h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">Join your content team</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="fullName" className="block text-[13px] font-medium text-foreground mb-1.5">
            Full name
          </label>
          <input
            id="fullName" type="text" autoComplete="name" required
            value={fullName} onChange={(e) => setFullName(e.target.value)}
            className={inputCls} placeholder="Jane Smith"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-[13px] font-medium text-foreground mb-1.5">
            Email
          </label>
          <input
            id="email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            className={inputCls} placeholder="you@company.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-[13px] font-medium text-foreground mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="password" type={showPassword ? "text" : "password"}
              autoComplete="new-password" required minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className={cn(inputCls, "pr-9")} placeholder="Min. 8 characters"
            />
            <button
              type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors mt-4"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-[12px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline underline-offset-2 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
