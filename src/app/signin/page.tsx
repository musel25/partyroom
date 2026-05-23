import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DuoButton } from "@/components/theme/duo-button";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="min-h-screen flex items-center justify-center bg-duo-cream p-6">
      <div className="bg-white rounded-2xl p-10 max-w-md w-full border-b-[4px] border-duo-border text-center">
        <div className="text-4xl mb-4">▶</div>
        <h1 className="text-2xl font-bold text-duo-text mb-2">Welcome to partyroom</h1>
        <p className="text-sm text-duo-muted mb-8">Watch YouTube together. Sync. Chat. Vibe.</p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <DuoButton type="submit" variant="primary" className="w-full">
            Continue with Google
          </DuoButton>
        </form>

        <p className="text-xs text-duo-faint mt-6">
          By signing in you agree to nothing — this is a personal project.
        </p>
      </div>
    </main>
  );
}
