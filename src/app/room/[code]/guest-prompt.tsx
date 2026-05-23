import { DuoButton } from "@/components/theme/duo-button";
import { claimGuestName } from "./actions";

export function GuestPrompt({ code }: { code: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fffaf0] p-6">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full border-b-[4px] border-[#e5e5e5]">
        <h1 className="text-xl font-bold text-[#3c3c3c] mb-2">Join the party</h1>
        <p className="text-sm text-[#777] mb-5">Pick a name to show in chat.</p>
        <form action={claimGuestName} className="space-y-3">
          <input type="hidden" name="code" value={code} />
          <input
            name="name"
            required
            minLength={1}
            maxLength={24}
            placeholder="Your name"
            className="w-full rounded-xl px-4 py-3 bg-[#f7f7f7] focus:outline-none focus:bg-white border-2 border-transparent focus:border-[#58cc02]"
          />
          <DuoButton type="submit" variant="primary" className="w-full">Join room</DuoButton>
        </form>
      </div>
    </main>
  );
}
