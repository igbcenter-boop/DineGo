"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-dg mt-16 max-w-lg text-center">
      <div className="card space-y-4">
        <h1 className="h1">Une erreur est survenue</h1>
        <p className="text-sm text-muted">Vérifiez votre connexion internet puis réessayez. Si le problème persiste, contactez l&apos;assistance.</p>
        <button onClick={reset} className="btn-primary">Réessayer</button>
      </div>
    </div>
  );
}
