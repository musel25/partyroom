import { DuoButton } from "@/components/theme/duo-button";
import { claimGuestName } from "./actions";

export function GuestPrompt({ code }: { code: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-duo-cream p-6">
      <div className="bg-duo-card rounded-2xl p-8 max-w-sm w-full border-b-[4px] border-duo-border">
        <h1 className="text-xl font-bold text-duo-text mb-2">Join the party</h1>
        <p className="text-sm text-duo-muted mb-5">Pick a name to show in chat.</p>
        <form action={claimGuestName} className="space-y-3">
          <input type="hidden" name="code" value={code} />
          <input
            name="name"
            required
            minLength={1}
            maxLength={24}
            placeholder="Your name"
            className="w-full rounded-xl px-4 py-3 bg-duo-soft focus:outline-none focus:bg-duo-card border-2 border-transparent focus:border-duo-green"
          />
          <DuoButton type="submit" variant="primary" className="w-full">Join room</DuoButton>
        </form>
      </div>
    </main>
  );
}
