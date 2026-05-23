import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((_req) => {
  // Default behavior: Auth.js redirects unauthenticated users to the signin
  // page (configured in authConfig.pages.signIn) for any matched route.
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|signin|room).*)"],
};
