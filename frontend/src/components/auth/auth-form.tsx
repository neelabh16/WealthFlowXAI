"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import type { LoginPayload, RegisterPayload } from "@/types";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hydrated, isAuthenticated, login, register } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginValues, setLoginValues] = useState<LoginPayload>({
    email: "",
    password: "",
  });
  const [signupValues, setSignupValues] = useState<RegisterPayload>({
    email: "",
    username: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");

  const nextPath = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace(nextPath as Route);
    }
  }, [hydrated, isAuthenticated, nextPath, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (mode === "signup" && signupValues.password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(loginValues);
      } else {
        await register(signupValues);
      }

      router.push(nextPath as Route);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to complete that request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="glass-card p-8 sm:p-10">
        <div className="mb-6">
          <p className="eyebrow">{mode === "login" ? "Account access" : "Create account"}</p>
          <h2 className="mt-3 font-display text-3xl text-[color:var(--text-strong)]">{mode === "login" ? "Log in" : "Sign up"}</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            {mode === "login" ? "Sign in to continue to your dashboard and financial tools." : "Create your account to start tracking and growing your money."}
          </p>
        </div>

        <div className="grid gap-5">
          {mode === "signup" ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="field-label">
                  First name
                  <input
                    required
                    className="input-field"
                    value={signupValues.first_name}
                    onChange={(event) => setSignupValues((current) => ({ ...current, first_name: event.target.value }))}
                  />
                </label>
                <label className="field-label">
                  Last name
                  <input
                    required
                    className="input-field"
                    value={signupValues.last_name}
                    onChange={(event) => setSignupValues((current) => ({ ...current, last_name: event.target.value }))}
                  />
                </label>
              </div>

              <label className="field-label">
                Username
                <input
                  required
                  className="input-field"
                  value={signupValues.username}
                  onChange={(event) => setSignupValues((current) => ({ ...current, username: event.target.value }))}
                />
              </label>
            </>
          ) : null}

          <label className="field-label">
            Email
            <input
              required
              type="email"
              className="input-field"
              value={mode === "login" ? loginValues.email : signupValues.email}
              onChange={(event) =>
                mode === "login"
                  ? setLoginValues((current) => ({ ...current, email: event.target.value }))
                  : setSignupValues((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>

          <label className="field-label">
            Password
            <input
              required
              type="password"
              className="input-field"
              minLength={8}
              value={mode === "login" ? loginValues.password : signupValues.password}
              onChange={(event) =>
                mode === "login"
                  ? setLoginValues((current) => ({ ...current, password: event.target.value }))
                  : setSignupValues((current) => ({ ...current, password: event.target.value }))
              }
            />
          </label>

          {mode === "signup" ? (
            <label className="field-label">
              Confirm password
              <input required type="password" className="input-field" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
          ) : null}
        </div>

        {error ? <p className="mt-5 rounded-2xl border border-[color:var(--danger-soft)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-text)]">{error}</p> : null}

        <button type="submit" disabled={isSubmitting} className="button-primary mt-8 inline-flex w-full items-center justify-center gap-2">
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          <span>{mode === "login" ? "Log in" : "Create account"}</span>
        </button>

        <p className="mt-5 text-center text-sm text-muted">
          {mode === "login" ? "Need an account?" : "Already have an account?"}{" "}
          <Link href={mode === "login" ? "/signup" : "/login"} className="font-semibold text-[color:var(--brand)]">
            {mode === "login" ? "Sign up" : "Log in"}
          </Link>
        </p>
      </form>
    </div>
  );
}
