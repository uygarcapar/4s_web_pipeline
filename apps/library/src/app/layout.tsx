import type { Metadata } from "next";

import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Archetype library",
  description: "Every archetype under every direction (D10 §12 B1).",
  robots: { index: false, follow: false },
};

/**
 * The library is an internal review surface and is never deployed: it has no
 * place in a client's site, and its previews render fixture copy. `robots`
 * is belt and braces for a stray local tunnel.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
