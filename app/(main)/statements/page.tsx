import { db } from "@/db";
import { clients } from "@/db/schema";
import { PageHeader, Card, EmptyState, LinkButton } from "@/components/ui";
import StatementForm from "@/components/StatementForm";

export const dynamic = "force-dynamic";

export default async function StatementsPage() {
  const allClients = await db.select().from(clients).orderBy(clients.name);

  return (
    <div>
      <PageHeader eyebrow="Accounts" title="Statements" />

      {allClients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          hint="Add a client to generate a statement of their account."
          action={<LinkButton href="/clients/new">Add a client</LinkButton>}
        />
      ) : (
        <Card className="max-w-xl">
          <StatementForm clients={allClients.map((c) => ({ id: c.id, name: c.name }))} />
        </Card>
      )}
    </div>
  );
}
