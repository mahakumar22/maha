import { signUp } from "@/app/auth/actions";
import { AuthForm } from "@/components/AuthForm";

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted">Pick a habit, show up daily, watch the streak grow.</p>
      </div>

      <AuthForm mode="signup" action={signUp} />
    </main>
  );
}
