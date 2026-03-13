import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { AuthProvider } from "@/components/auth-provider";
import { AuthHeader } from "@/components/auth-header";

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
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        <AuthProvider>
          <AuthHeader />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
