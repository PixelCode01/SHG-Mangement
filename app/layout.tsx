import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation";
import ClientSetup from "./components/ClientSetup";
import PerformanceOptimizer from "./components/PerformanceOptimizer";
import { ThemeProvider } from "./components/ThemeProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "SHG Management",
  description: "Self-Help Group Management System",
  other: {
    'color-scheme': 'light dark',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PerformanceOptimizer />
          <ClientSetup>
            <div className="flex flex-col min-h-screen">
              <Navigation />
              <main className="flex-grow p-4 md:p-6 pt-6 max-w-7xl mx-auto w-full">
                {children}
              </main>
              <footer className="py-6 px-4 border-t border-border bg-card-bg">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
                  <div className="text-muted text-sm mb-4 md:mb-0">
                    SHG Management © {new Date().getFullYear()}
                  </div>
                </div>
              </footer>
            </div>
          </ClientSetup>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <SpeedInsights />}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}
