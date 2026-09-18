import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Koya Content Agent",
    template: "%s | Koya Content Agent",
  },
  description: "AI-powered content research and publishing platform for modern marketing teams.",
  robots: { index: false, follow: false }, // internal tool — no public indexing
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={5000}
        />
      </body>
    </html>
  );
}
