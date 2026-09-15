import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const DESCRIPTION =
  "Lens is the single source of truth for UX research — recruit participants, analyze interviews, surface insights with AI, and turn evidence into product decisions.";

export const metadata: Metadata = {
  metadataBase: new URL("https://lensresearch.app"),
  title: {
    default: "Lens — UX Research Repository",
    template: "%s · Lens",
  },
  description: DESCRIPTION,
  applicationName: "Lens",
  keywords: [
    "UX research repository",
    "user research platform",
    "research repository software",
    "UX research tool",
    "customer insight management",
    "interview analysis software",
    "qualitative research platform",
    "research operations",
    "insights repository",
    "product research tool",
  ],
  authors: [{ name: "Lens" }],
  creator: "Lens",
  publisher: "Lens",
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Lens",
    title: "Lens — UX Research Repository",
    description: DESCRIPTION,
    url: "https://lensresearch.app",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lens — UX Research Repository",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1117" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Runs before hydration to prevent a flash of the wrong theme.
const themeScript = `
(function () {
  try {
    // Fixed default: light. Only 'dark', or 'system' matching a dark OS, goes dark.
    var stored = localStorage.getItem('lens-theme');
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || (stored === 'system' && system);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
