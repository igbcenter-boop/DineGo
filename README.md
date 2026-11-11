# DineGo

**Choisissez. Commandez. Savourez.** — Marketplace nationale de restauration et de livraison au Burkina Faso.

Application web responsive (Next.js 16 + Supabase) qui réunit les cinq profils du cahier des charges : visiteurs, clients, restaurants, livreurs et administration DineGo.

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run db:migrate           # applique supabase/migrations/*.sql
npm run db:seed              # données de démonstration (facultatif)
npm run dev                  # http://localhost:3000
```

### Variables d'environnement (`.env.local`, jamais versionné)

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique (lectures soumises au RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé de service, **serveur uniquement** |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` | Utilisés par `npm run db:migrate` |
| `PAYMENT_WEBHOOK_SECRET` | Signature HMAC du webhook de paiement |

`npm run db:seed` crée des comptes de démonstration (administrateur, client, livreur, 4 restaurants) et écrit leurs identifiants dans `credentials.local.txt` (non versionné).

## Tests de réception

Avec un serveur lancé (`npm run build && npx next start -p 3100`) :

```bash
npm run test:e2e
```

Le scénario, piloté par Microsoft Edge via Playwright, couvre les parcours du §23 : panier mono-restaurant, commande, livraison par le réseau DineGo, encaissement en espèces et double confirmation empêchée, paiement Mobile Money vérifié, ventilation et confidentialité, reversement quotidien et retard, inscriptions et validations, cloisonnement des rôles, affichage mobile.

## Organisation

```
app/                 pages (App Router) et actions serveur (app/actions)
  restaurants/       espace public : recherche, fiche, menu
  panier, commande/  parcours de commande
  compte/            espace client, suivi de commande
  restaurant/        back-office restaurant
  livreur/           espace livreur
  admin/             administration centrale
components/          logo officiel, bannières (§27), panier, UI
lib/                 règles métier : finance (ventilation), commandes, encaissements
supabase/migrations/ schéma, sécurité RLS, données de référence
scripts/             migration, données de démo, test de bout en bout
```

## Règles métier clés

- **Une commande = un restaurant**, contrôlé dans le panier puis côté serveur ; les prix sont toujours relus en base.
- **Ventilation** restaurant / livreur / DineGo figée à la confirmation (`order_financials`), jamais montrée au client. Les frais sont versionnés et non rétroactifs.
- **Encaissement** par DineGo ou par le restaurant (choix historisé). Les échéances de reversement (quotidiennes ou hebdomadaires) sont constituées à la clôture de chaque période.
- **Espèces** : une confirmation numérique unique par commande (contrainte en base). Tout écart ouvre une anomalie ; les corrections sont motivées et tracées.
- **Paiement numérique** : la référence déclarée par le client ne suffit pas. Le paiement est confirmé par le bénéficiaire après vérification, ou par le prestataire via `POST /api/payments/webhook`.
- **Sécurité** : RLS sur toutes les tables ; écritures uniquement via des actions serveur qui revérifient le rôle ; le rôle administrateur n'est jamais attribuable à l'inscription.

## À brancher avant la mise en production (§25)

- Contrat avec un agrégateur de paiement (Orange Money, Moov Money, carte), puis adaptation du format du webhook.
- Prestataires SMS / e-mail : les notifications sont aujourd'hui affichées dans la plateforme (`lib/notify.ts`).
- Validation des taux de commission, des règles d'annulation et de remboursement (modifiables dans Administration › Paramètres).
