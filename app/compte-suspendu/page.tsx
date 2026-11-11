import Link from "next/link";
import { signOut } from "@/app/actions/auth";

export default function SuspendedPage() {
  return (
    <div className="container-dg mt-16 max-w-lg text-center">
      <div className="card space-y-4">
        <h1 className="h1">Compte suspendu</h1>
        <p className="text-sm text-muted">
          Votre compte a été suspendu par l&apos;administration DineGo. Contactez le service client pour en connaître le motif.
        </p>
        <div className="flex justify-center gap-2">
          <Link href="/aide" className="btn-primary">Contacter l&apos;assistance</Link>
          <form action={signOut}>
            <button className="btn-outline">Se déconnecter</button>
          </form>
        </div>
      </div>
    </div>
  );
}
