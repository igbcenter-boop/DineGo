import type { NextConfig } from "next";

// DineGo affiche des données propres à chaque utilisateur (session, panier,
// commandes) sur la quasi-totalité des pages : le rendu est donc dynamique
// par défaut et Cache Components n'est pas activé.
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Envoi des photos de plats, logos et couvertures (max 5 Mo côté stockage)
      bodySizeLimit: "6mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
