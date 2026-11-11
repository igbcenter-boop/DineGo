import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/Banner";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { signUpClient } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignupPage(props: PageProps<"/inscription">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  return (
    <>
      <Banner
        tone="white"
        crumbs={[{ label: "Inscription" }]}
        title="Créez votre compte pour"
        highlight="commander."
        text="La consultation est libre. Le compte vous permet de valider vos commandes, de les suivre et d'enregistrer vos adresses."
        illustration="phone"
      >
        <Link href={`/connexion${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="btn-outline">
          J&apos;ai déjà un compte
        </Link>
      </Banner>
      <div className="container-dg mt-8 max-w-md">
        <Flash searchParams={props.searchParams} />
        <form action={signUpClient} className="card space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="label" htmlFor="full_name">Nom et prénom</label>
            <input id="full_name" name="full_name" required autoComplete="name" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Téléphone</label>
            <input id="phone" name="phone" type="tel" required autoComplete="tel" placeholder="+226 70 00 00 00" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Mot de passe (8 caractères minimum)</label>
            <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
          </div>
          <SubmitButton className="btn-primary w-full">Créer mon compte</SubmitButton>
        </form>
      </div>
    </>
  );
}
