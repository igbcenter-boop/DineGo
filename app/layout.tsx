import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart";
import { Footer, Header } from "@/components/Header";

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
};

export const viewport: Viewport = {
  themeColor: "#4B176D",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${montserrat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
