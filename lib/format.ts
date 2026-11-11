export function fcfa(n: number | null | undefined) {
  const v = Math.round(Number(n ?? 0));
  return v.toLocaleString("fr-FR").replace(/ | /g, " ") + " FCFA";
}

export function dateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Ouagadougou",
  });
}

export function dateOnly(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { timeZone: "Africa/Ouagadougou" });
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export const ORDER_STATUS: Record<string, string> = {
  sent: "Commande envoyée",
  received: "Reçue par le restaurant",
  accepted: "Commande acceptée",
  preparing: "Préparation en cours",
  ready: "Commande prête",
  awaiting_pickup: "En attente de retrait",
  delivering: "Livraison en cours",
  handed_over: "Remise au client",
  completed: "Commande terminée",
  refused: "Refusée",
  cancelled: "Annulée",
  not_delivered: "Non livrée",
};

export const PAYMENT_METHOD: Record<string, string> = {
  orange_money: "Orange Money",
  moov_money: "Moov Money",
  other_mobile_money: "Autre Mobile Money",
  card: "Carte bancaire",
  cash: "Espèces",
};

export const PAYMENT_STATUS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  failed: "Échoué",
  cancelled: "Annulé",
  refunded: "Remboursé",
  partially_refunded: "Partiellement remboursé",
};

export const MISSION_STATUS: Record<string, string> = {
  proposed: "Proposée",
  accepted: "Acceptée",
  refused: "Refusée",
  picked_up: "Commande récupérée",
  arrived: "Arrivé chez le client",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export const SETTLEMENT_STATUS: Record<string, string> = {
  pending: "À régler",
  partial: "Partiellement réglé",
  paid: "Réglé",
  late: "En retard",
};

export const TICKET_STATUS: Record<string, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  rejected: "Rejeté",
};

export const COMPLAINT_TYPES: Record<string, string> = {
  retard: "Retard",
  incomplete: "Commande incomplète",
  produit_incorrect: "Produit incorrect",
  qualite: "Mauvaise qualité",
  non_recue: "Commande non reçue",
  paiement: "Problème de paiement",
  autre: "Autre",
};

export const REFUND_STATUS: Record<string, string> = {
  requested: "Demandé",
  approved: "Approuvé",
  rejected: "Rejeté",
  paid: "Remboursé",
};

export const ROLE_LABEL: Record<string, string> = {
  client: "Client",
  restaurant: "Restaurant",
  livreur: "Livreur",
  admin: "Administrateur",
};

export const PRICE_LEVEL = ["", "Économique", "Moyen", "Haut de gamme"];

export const DIGITAL_METHODS = ["orange_money", "moov_money", "other_mobile_money", "card"];

export function isOpenNow(r: { is_open: boolean; opens_at: string | null; closes_at: string | null }) {
  if (!r.is_open) return false;
  if (!r.opens_at || !r.closes_at) return true;
  const now = new Date().toLocaleTimeString("fr-FR", { hour12: false, timeZone: "Africa/Ouagadougou" }).slice(0, 5);
  const o = r.opens_at.slice(0, 5);
  const c = r.closes_at.slice(0, 5);
  return o <= c ? now >= o && now < c : now >= o || now < c;
}

export function msg(path: string, type: "ok" | "error", text: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${type}=${encodeURIComponent(text)}`;
}
