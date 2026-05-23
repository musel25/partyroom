"use server";

import { randomUUID } from "node:crypto";
import { setGuestCookie } from "@/lib/auth-guest";
import { redirect } from "next/navigation";

export async function claimGuestName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 24);
  const code = String(formData.get("code") ?? "");
  if (!name || !code) return;
  await setGuestCookie({ guestId: randomUUID(), guestName: name });
  redirect(`/room/${code}`);
}
