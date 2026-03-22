import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { AuthProvider } from "@/lib/context/auth-context";
import { AuthModals } from "@/components/auth/auth-modals";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "CopyFlow | Editorial Intelligence",
  description: "Transform your audiovisual assets into sophisticated editorial content.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${newsreader.variable} antialiased`}
      >
        <AuthProvider>
          {children}
          <AuthModals />
        </AuthProvider>
      </body>
    </html>
  );
}
