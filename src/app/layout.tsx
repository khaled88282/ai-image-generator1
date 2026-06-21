import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Free AI Image Generator - No Signup, No Limits",
  description:
    "Generate stunning AI images instantly with our free tool powered by Z-Image Turbo. Transform text to art in seconds. No signup required - start creating now!",
  keywords: [
    "AI image generator",
    "free AI art",
    "text to image",
    "AI art generator",
    "free image creation",
    "online art generator",
    "z-image turbo",
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
