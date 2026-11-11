import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Empty } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { markNotificationsRead } from "@/app/actions/client";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireRole(["client", "restaurant", "livreur", "admin"], "/notifications");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).filter((n) => !n.read).length;
  return (
    <div className="container-dg mt-8 max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Notifications</h1>
        {unread > 0 && (
          <form action={markNotificationsRead}>
            <SubmitButton className="btn-outline btn-sm">Tout marquer comme lu ({unread})</SubmitButton>
          </form>
        )}
      </div>
      {data?.length ? (
        <ul className="space-y-2">
          {data.map((n) => (
            <li key={n.id} className={`card ${n.read ? "" : "border-l-4 border-l-orange"}`}>
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-bold text-violet">{n.title}</p>
                <span className="text-xs text-muted">{dateTime(n.created_at)}</span>
              </div>
              {n.body && <p className="text-sm">{n.body}</p>}
              {n.link && (
                <Link href={n.link} className="mt-1 inline-block text-sm font-semibold text-violet underline">
                  Voir
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Aucune notification.</Empty>
      )}
    </div>
  );
}
