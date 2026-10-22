import type { Metadata } from "next";

import { ALL_FACE_VARIABLES } from "./faces.generated";
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
 *
 * Every registry face is loaded here, not just one pairing: a preview sets
 * `--font-display-face` to whichever face its direction chose, so the faces
 * all have to be available before the direction is known. A client site
 * loads only the two or three its own direction picked.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ALL_FACE_VARIABLES} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
