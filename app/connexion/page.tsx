import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/Banner";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { signIn } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage(props: PageProps<"/connexion">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const signupHref = `/inscription${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <>
      <Banner
        tone="white"
        crumbs={[{ label: "Connexion" }]}
        title="Connectez-vous pour"
        highlight="commander."
        text="La consultation est libre. Un compte est simplement demandé au moment de valider votre commande."
        illustration="phone"
      >
        <a href="#form" className="btn-primary">
          Se connecter
        </a>
        <Link href={signupHref} className="btn-outline">
          Créer un compte
        </Link>
      </Banner>
      <div id="form" className="container-dg mt-8 max-w-md scroll-mt-20">
        <Flash searchParams={props.searchParams} />
        <form action={signIn} className="card space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Mot de passe</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <SubmitButton className="btn-primary w-full">Se connecter</SubmitButton>
          <p className="text-center text-sm text-muted">
            Pas encore de compte ? <Link href={signupHref} className="font-bold text-violet underline">Inscrivez-vous</Link>
          </p>
        </form>
        <p className="mt-4 text-center text-xs text-muted">
          Restaurateur ? <Link href="/devenir-partenaire" className="underline">Inscrire mon restaurant</Link> · Livreur ?{" "}
          <Link href="/devenir-livreur" className="underline">Rejoindre le réseau</Link>
        </p>
      </div>
    </>
  );
}
