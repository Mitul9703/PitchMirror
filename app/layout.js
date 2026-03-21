import "@/app/globals.css";
import { AppProvider } from "@/components/app-provider";
import { SiteShell } from "@/components/site-shell";

export const metadata = {
  title: "PitchMirror",
  description: "AI rehearsal room with scenario-specific judges and a live avatar session.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProvider>
          <SiteShell>{children}</SiteShell>
        </AppProvider>
      </body>
    </html>
  );
}
