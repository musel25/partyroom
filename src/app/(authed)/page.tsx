import { auth, signOut } from "@/lib/auth";
import { HeroCreateRoom } from "@/components/home/hero-create-room";
import { FriendsSidebar } from "@/components/home/friends-sidebar";

export default async function Home() {
  const session = await auth();
  const name = session?.user?.name?.split(" ")[0] ?? "friend";

  return (
    <main className="min-h-screen bg-[#fffaf0] p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-6 bg-white rounded-xl px-5 py-3 border-b-[3px] border-[#e5e5e5]">
          <div className="text-xl font-bold text-[#58cc02]">▶ partyroom</div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/signin" }); }}>
            <button className="text-sm font-bold text-[#777] hover:text-[#3c3c3c]">Sign out</button>
          </form>
        </header>

        <div className="grid md:grid-cols-[1fr_280px] gap-5">
          <div className="space-y-5">
            <HeroCreateRoom userName={name} />
            <section className="bg-white rounded-2xl p-5 border-b-[3px] border-[#e5e5e5]">
              <div className="text-xs font-bold uppercase text-[#999] mb-3">Recent rooms</div>
              <p className="text-sm text-[#777]">No rooms yet — create one above!</p>
            </section>
          </div>
          <FriendsSidebar />
        </div>
      </div>
    </main>
  );
}
