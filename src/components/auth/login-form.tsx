"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, LogIn, AlertCircle, CheckCircle2, Copy, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/db/browser-client";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full h-9 px-3 rounded-md border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 transition-shadow";

const DEMO_ACCOUNTS = [
  {
    role: "Admin",
    email: "admin@koya-demo.com",
    password: "DemoAdmin2026!",
    description: "Full access, user management, audit log",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
  },
  {
    role: "Reviewer",
    email: "reviewer@koya-demo.com",
    password: "DemoReview2026!",
    description: "Reviews and approves content",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
  },
  {
    role: "Content Manager",
    email: "manager@koya-demo.com",
    password: "DemoManager2026!",
    description: "Creates and manages content",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
  },
];

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex items-center justify-between w-full gap-2 px-2.5 py-1.5 rounded bg-white/60 dark:bg-black/20 border border-black/8 dark:border-white/10 hover:bg-white dark:hover:bg-black/30 transition-colors text-left"
      title="Click to copy"
    >
      <span className="text-[11px] font-mono text-foreground/80 truncate">{value}</span>
      <span className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
        {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
      </span>
    </button>
  );
}

function DemoAccountCard({
  account,
  onUse,
}: {
  account: (typeof DEMO_ACCOUNTS)[0];
  onUse: (email: string, password: string) => void;
}) {
  return (
    <div className={cn("rounded-lg border p-3 space-y-2", account.bg, account.border)}>
      <div className="flex items-center justify-between">
        <span className={cn("text-[11px] font-semibold uppercase tracking-wider", account.color)}>
          {account.role}
        </span>
        <button
          type="button"
          onClick={() => onUse(account.email, account.password)}
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors",
            "bg-white/70 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40",
            account.border,
            account.color
          )}
        >
          Use this
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">{account.description}</p>
      <div className="space-y-1">
        <CopyField value={account.email} />
        <CopyField value={account.password} />
      </div>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const urlError = searchParams.get("error");
  const urlSuccess = searchParams.get("success");

  useEffect(() => {
    if (urlError) toast.error("Authentication error", { description: urlError });
    if (urlSuccess) toast.success(urlSuccess);
  }, [urlError, urlSuccess]);

  function handleUseDemoAccount(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setShowDemo(false);
    toast.info("Credentials filled in — click Sign in");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Sign in failed", { description: error.message });
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Main sign-in card */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="mb-5">
          <h1 className="text-[15px] font-semibold text-foreground">Sign in</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">Welcome back</p>
        </div>

        {urlError && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-md bg-[hsl(var(--danger-subtle))] border border-[hsl(var(--danger-border))] text-[12px] text-red-700 dark:text-red-400">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>{urlError}</span>
          </div>
        )}

        {urlSuccess && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-md bg-[hsl(var(--success-subtle))] border border-[hsl(var(--success-border))] text-[12px] text-green-700 dark:text-green-400">
            <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
            <span>{urlSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-[13px] font-medium text-foreground mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[13px] font-medium text-foreground mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(inputCls, "pr-9")}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-primary text-white text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors mt-4"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          Need an account?{" "}
          <Link href="/signup" className="text-primary hover:underline underline-offset-2 font-medium">
            Sign up
          </Link>
        </p>
      </div>

      {/* Demo accounts panel */}
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDemo((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-[12px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[9px] font-bold">
              3
            </span>
            <span className="font-medium">Demo accounts</span>
            <span className="text-muted-foreground/60">· click to {showDemo ? "hide" : "show"}</span>
          </span>
          <svg
            className={cn("h-3.5 w-3.5 transition-transform", showDemo && "rotate-180")}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {showDemo && (
          <div className="px-4 pb-4 space-y-2.5">
            <p className="text-[11px] text-muted-foreground/70 pt-0.5">
              Click any field to copy, or use the &ldquo;Use this&rdquo; button to auto-fill the form above.
            </p>
            {DEMO_ACCOUNTS.map((account) => (
              <DemoAccountCard
                key={account.email}
                account={account}
                onUse={handleUseDemoAccount}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
