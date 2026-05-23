import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/signin" },
  // JWT sessions: edge-safe middleware can decode them without a DB call.
  // Database sessions would force middleware to talk to Prisma (no Edge support).
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Google's auth response sometimes omits the `iss` URL parameter;
      // Auth.js's strict OIDC checks then reject the callback. PKCE alone
      // is sufficient for our threat model.
      checks: ["pkce"],
    }),
  ],
  callbacks: {
    // Surface the user's stable id on the session so downstream code (API
    // routes, socket layer) can rely on `session.user.id`.
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
