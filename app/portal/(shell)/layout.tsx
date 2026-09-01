import PortalNav from "@/components/PortalNav";
import { ToastProvider } from "@/components/ToastProvider";
import { getEnabledModules } from "@/lib/enabled-modules";
import { getSettings } from "@/lib/numbering";
import { sessionPortalUser } from "@/lib/auth-portal";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import PortalDisabled from "./PortalDisabled";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const enabled = await getEnabledModules();
  if (enabled["clientPortal"] === false) {
    return <PortalDisabled />;
  }

  const settings = await getSettings();
  const session = await sessionPortalUser();
  if (!session) redirect("/portal/login");

  const client = await db.query.clients.findFirst({ where: eq(clients.id, session.clientId) });
  if (!client) redirect("/portal/login");

  const disabledKeys = Object.entries(enabled)
    .filter(([, on]) => !on)
    .map(([key]) => key);

  return (
    <div className="flex min-h-dvh">
      <PortalNav
        logoData={settings.logoDarkData}
        companyName={settings.companyName}
        disabledKeys={disabledKeys}
        clientName={client.name}
      />
      <main className="min-w-0 flex-1 bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </main>
    </div>
  );
}