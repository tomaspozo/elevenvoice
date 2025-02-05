import "./globals.css";

import { ThemeSwitcher } from "@/components/theme-switcher";

import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { BackgroundWave } from "@/components/background-wave";

import AuthButton from "@/components/header-auth";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "ElevenVoice",
  description:
    "Generate your own voice training files for ElevenLabs voice cloning.",
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen flex flex-col items-center">
            <div className="flex flex-col flex-grow w-full items-center justify-center sm:px-4">
              <nav className="bg-background/90 sm:fixed w-full top-0 left-0 grid grid-cols-2 py-4 px-8">
                <div className={"flex"}>
                  <Link href={"/"} prefetch={true} className="font-semibold">
                    ElevenVoice
                  </Link>
                </div>

                <div className={"flex gap-4 justify-end"}>
                  <AuthButton />
                </div>
              </nav>
              {children}
              <BackgroundWave />
            </div>
          </main>
          <footer className="w-full bg-background/90 flex flex-col items-center justify-center border-t mx-auto text-center text-xs gap-4 py-12">
            <p>
              Built by{" "}
              <a
                href="https://x.com/tomaspozo_"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold hover:underline"
                aria-label="Follow me on X"
              >
                @tomaspozo_
              </a>
            </p>
            <p>
              Get the source code on{" "}
              <a
                href="https://github.com/tomaspozo/elevenvoice"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold hover:underline"
                aria-label="Follow me on X"
              >
                Github
              </a>
            </p>
            <ThemeSwitcher />
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
