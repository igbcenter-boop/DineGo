import Link from "next/link";
import { LogoSymbol } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="container-dg mt-16 max-w-lg text-center">
      <div className="card space-y-4">
        <div className="flex justify-center"><LogoSymbol size={64} /></div>
        <h1 className="h1">Page introuvable</h1>
        <p className="text-sm text-muted">Ce plat n&apos;est pas (ou plus) au menu. Retournez à l&apos;accueil pour continuer.</p>
        <div className="flex justify-center gap-2">
          <Link href="/" className="btn-primary">Accueil</Link>
          <Link href="/restaurants" className="btn-outline">Restaurants</Link>
        </div>
      </div>
    </div>
  );
}
