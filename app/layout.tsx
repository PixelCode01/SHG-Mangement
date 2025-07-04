import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation";
import ClientSetup from "./components/ClientSetup";
import { ThemeProvider } from "./components/ThemeProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SHG Management",
  description: "Self-Help Group Management System",
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
                  <div className="flex space-x-4">
                    <a
                      href="#"
                      className="text-sm text-muted hover:text-primary transition-colors"
                    >
                      About
                    </a>
                    <a
                      href="#"
                      className="text-sm text-muted hover:text-primary transition-colors"
                    >
                      Terms
                    </a>
                    <a
                      href="#"
                      className="text-sm text-muted hover:text-primary transition-colors"
                    >
                      Privacy
                    </a>
                    <a
                      href="#"
                      className="text-sm text-muted hover:text-primary transition-colors"
                    >
                      Contact
                    </a>
                  </div>
                </div>
              </footer>
            </div>
          </ClientSetup>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
