import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "./db";
import { authConfig } from "./auth.config";

// PrismaAdapter still persists users + accounts. We just use JWT sessions
// (declared in authConfig) instead of DB sessions so middleware works.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
});
