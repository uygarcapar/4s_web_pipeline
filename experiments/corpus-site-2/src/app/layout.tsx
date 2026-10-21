import type { Metadata } from "next";

import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kat — aynı ölçümün ikinci okuması",
  description:
    "Aynı korpus, başka bir kol: açık zemin, serif display, üst üste yığılan " +
    "katmanlar ve derinlik.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
