import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { ViewTransition } from "react";
import "./globals.css";
import { CartProvider } from "@/components/cart";
import { Footer, Header } from "@/components/Header";
import { CartBar } from "@/components/CartWidgets";
import { AppShell } from "@/components/AppShell";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { createClient } from "@/lib/supabase/server";

// Typographie officielle (§26.3) : Montserrat ExtraBold pour titres, Medium/Regular pour les textes
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "DineGo — Choisissez. Commandez. Savourez.", template: "%s · DineGo" },
  description: "La marketplace nationale de restauration et de livraison du Burkina Faso : découvrez les restaurants, commandez et faites-vous livrer.",
  appleWebApp: { title: "DineGo", capable: true, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#4B176D",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("name, slug, icon").order("sort");
  return (
    <html lang="fr" className={`${montserrat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <CartProvider>
          <Header />
          <ViewTransition>
            <main className="flex-1 pb-24 md:pb-0">
              <AppShell categories={categories ?? []}>{children}</AppShell>
            </main>
          </ViewTransition>
          <CartBar />
          <WhatsAppButton />
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
