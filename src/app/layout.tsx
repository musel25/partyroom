import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "partyroom",
  description: "Watch YouTube together. Sync. Chat. Vibe.",
};

// Inline boot script — applies the user's saved theme before React
// hydrates so the page doesn't flash. Default is light; users opt
// in to dark via the header toggle.
const themeBootScript = `(function(){try{var t=localStorage.getItem('partyroom.theme')||'light';document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={nunito.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
