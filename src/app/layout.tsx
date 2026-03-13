import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/error-boundary";

export const metadata: Metadata = {
  title: "AI Code Review Agent — Mediagenix AIR",
  description: "Intelligent code analysis powered by AI. Built on the Mediagenix AIR Platform.",
  keywords: ["code review", "AI", "static analysis", "security", "TypeScript", "React"],
  authors: [{ name: "Mediagenix AIR" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
