import type { Metadata } from "next";

import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ölçülmüş — 56 ödüllü sitenin tasarım dili",
  description:
    "Awwwards Sites of the Day'den 56 site, beş katmanda ölçüldü: tipografi, " +
    "token sistemleri, çalışma anı hareket profili, JS paketleri ve mobil davranış.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
