import { AuthForm } from "@/components/auth/auth-form";

export default function SignupPage() {
  return (
    <main className="grid-shell py-10 sm:py-14">
      <AuthForm mode="signup" />
    </main>
  );
}
