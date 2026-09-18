import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="bg-white rounded-xl shadow-2xl p-8 animate-pulse h-80" />}>
      <LoginForm />
    </Suspense>
  );
}
