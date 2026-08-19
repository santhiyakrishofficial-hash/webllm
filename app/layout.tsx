import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KidsZone AI Tutor",
  description: "Offline Browser AI Tutor for Kids",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
