import { db } from "@/db";
import { clients, invoices, quotations, portalUsers, clientActivities } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { updateClient, deleteClient, createPortalAccess, togglePortalAccess, resetPortalPassword, deletePortalAccess } from "@/lib/actions/clients";
import { addClientActivity, deleteClientActivity } from "@/lib/actions/client-activities";
import { PageHeader, Field, inputClass, PrimaryButton, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import ConfirmForm from "@/components/ConfirmForm";
import { formatDate } from "@/lib/money";
import { getEnabledModules } from "@/lib/enabled-modules";

export const dynamic = "force-dynamic";

const ACTIVITY_LABELS: Record<string, string> = {
  call: "Call",
  note: "Note",
  meeting: "Meeting",
  follow_up: "Follow-up",
  manual: "Note",
};

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = Number(id);
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) notFound();

  const clientInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.clientId, clientId))
    .orderBy(desc(invoices.createdAt));

  const clientQuotations = await db
    .select()
    .from(quotations)
    .where(eq(quotations.clientId, clientId))
    .orderBy(desc(quotations.createdAt));

  const activities = await db
    .select()
    .from(clientActivities)
    .where(eq(clientActivities.clientId, clientId))
    .orderBy(desc(clientActivities.createdAt))
    .limit(50);

  const logActivity = addClientActivity; // bound via hidden clientId input
  const enabled = await getEnabledModules();
  const portalOn = enabled["clientPortal"] !== false;
  const portalUsersRows = portalOn
    ? await db.select().from(portalUsers).where(eq(portalUsers.clientId, clientId)).orderBy(desc(portalUsers.createdAt))
    : [];

  const updateWithId = updateClient.bind(null, clientId);
  const deleteWithId = deleteClient.bind(null, clientId);
  const createAccess = createPortalAccess.bind(null, clientId);

  return (
    <div>
      <PageHeader eyebrow="Client file" title={client.name} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        <Card>
          <form action={updateWithId} className="space-y-4">
            <Field label="Name">
              <input name="name" defaultValue={client.name} required className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" defaultValue={client.email ?? ""} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input name="phone" defaultValue={client.phone ?? ""} className={inputClass} />
            </Field>
            <Field label="Billing address">
              <textarea name="address" defaultValue={client.address ?? ""} rows={3} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company registration">
                <input name="registrationNumber" defaultValue={client.registrationNumber ?? ""} className={inputClass} />
              </Field>
              <Field label="VAT number">
                <input name="vatNumber" defaultValue={client.vatNumber ?? ""} className={inputClass} />
              </Field>
            </div>
            <Field label="Notes">
              <textarea name="notes" defaultValue={client.notes ?? ""} rows={2} className={inputClass} />
            </Field>
            <div className="flex items-center justify-between pt-2">
              <PrimaryButton type="submit">Save changes</PrimaryButton>
              <ConfirmForm action={deleteWithId} confirm="Delete this client? Their invoices and statements will be gone too.">
                <button type="submit" className="font-mono text-xs uppercase tracking-wide text-rust hover:underline">
                  Delete client
                </button>
              </ConfirmForm>
            </div>
          </form>
        </Card>

        <div className="space-y-8">
          <div>
            <h2 className="mb-3 font-display text-lg font-bold text-navy">Invoices</h2>
            {clientInvoices.length === 0 ? (
              <p className="text-sm text-ink-soft">No invoices for this client yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-rule">
                <table className="w-full text-sm">
                  <tbody>
                    {clientInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                        <td className="px-4 py-2.5">
                          <Link href={`/invoices/${inv.id}`} className="font-mono text-ink hover:text-forest">
                            {inv.number}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-ink-soft">{formatDate(inv.issueDate)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <StatusStamp status={inv.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 font-display text-lg font-bold text-navy">Quotations</h2>
            {clientQuotations.length === 0 ? (
              <p className="text-sm text-ink-soft">No quotations for this client yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-rule">
                <table className="w-full text-sm">
                  <tbody>
                    {clientQuotations.map((q) => (
                      <tr key={q.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                        <td className="px-4 py-2.5">
                          <Link href={`/quotations/${q.id}`} className="font-mono text-ink hover:text-forest">
                            {q.number}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-ink-soft">{formatDate(q.issueDate)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <StatusStamp status={q.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 font-display text-lg font-bold text-navy">Activity log</h2>
            <Card className="mb-5">
              <form action={logActivity} className="space-y-3">
                <input type="hidden" name="clientId" value={clientId} />
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <Field label="Type">
                    <select name="type" defaultValue="manual" className={inputClass}>
                      <option value="manual">Note</option>
                      <option value="call">Call</option>
                      <option value="meeting">Meeting</option>
                      <option value="follow_up">Follow-up</option>
                    </select>
                  </Field>
                  <Field label="Title">
                    <input name="title" required className={inputClass} placeholder="e.g. Discussed quarterly maintenance plan" />
                  </Field>
                </div>
                <Field label="Details (optional)">
                  <textarea name="description" rows={2} className={inputClass} />
                </Field>
                <PrimaryButton type="submit">Log activity</PrimaryButton>
              </form>
            </Card>

            {activities.length === 0 ? (
              <p className="text-sm text-ink-soft">No activity logged yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-rule">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium">Type</th>
                      <th className="px-4 py-2.5 font-medium">Entry</th>
                      <th className="px-4 py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((a) => (
                      <tr key={a.id} className="border-b border-rule last:border-b-0">
                        <td className="px-4 py-2.5 text-ink-soft whitespace-nowrap">
                          {formatDate(a.createdAt.toISOString())}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${a.auto ? "bg-paper-dim text-ink-soft" : "bg-emerald-50 text-emerald-700"}`}>
                            {ACTIVITY_LABELS[a.type] ?? a.type}{a.auto ? " · auto" : ""}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-ink">{a.title}</div>
                          {a.description && <div className="text-xs text-ink-soft">{a.description}</div>}
                          {a.documentKind && (
                            <div className="text-xs text-ink-soft">on {a.documentKind.replace(/_/g, " ")}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <form action={deleteClientActivity.bind(null, a.id, clientId)}>
                            <button type="submit" className="text-xs text-rust hover:underline">Remove</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {portalOn && (
            <div>
              <h2 className="mb-3 font-display text-lg font-bold text-navy">Client portal access</h2>
              <Card>
                {portalUsersRows.length === 0 ? (
                  <p className="mb-4 text-sm text-ink-soft">
                    No portal logins yet. Create one below to let this client sign in and view their documents.
                  </p>
                ) : (
                  <ul className="mb-5 divide-y divide-rule">
                    {portalUsersRows.map((u) => (
                      <li key={u.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-ink">{u.name || u.email}</p>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${u.active ? "bg-emerald-50 text-emerald-700" : "bg-paper-dim text-ink-soft"}`}>
                              {u.active ? "Active" : "Disabled"}
                            </span>
                          </div>
                          <p className="truncate font-mono text-xs text-ink-soft">{u.email}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <form action={togglePortalAccess.bind(null, clientId, u.id)}>
                            <input type="hidden" name="active" value={u.active ? "off" : "on"} />
                            <button type="submit" className="text-xs font-medium text-ink hover:underline">
                              {u.active ? "Disable" : "Enable"}
                            </button>
                          </form>
                          <details className="relative">
                            <summary className="cursor-pointer text-xs font-medium text-ink hover:underline">Reset</summary>
                            <div className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-rule bg-white p-3 shadow-lg">
                              <form action={resetPortalPassword.bind(null, clientId, u.id)} className="space-y-2">
                                <Field label="New password">
                                  <input name="password" type="password" required minLength={8} className={inputClass} />
                                </Field>
                                <button type="submit" className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-paper hover:bg-navy-2">
                                  Reset password
                                </button>
                              </form>
                            </div>
                          </details>
                          <ConfirmForm action={deletePortalAccess.bind(null, clientId, u.id)} confirm="Revoke this client's portal access?" className="inline">
                            <button type="submit" className="text-xs font-medium text-rust hover:underline">
                              Revoke
                            </button>
                          </ConfirmForm>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={createAccess} className="space-y-3 border-t border-rule pt-4">
                  <p className="text-xs text-ink-soft">Add a client portal login:</p>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Field label="Name">
                      <input name="name" className={inputClass} placeholder="Primary contact" />
                    </Field>
                    <Field label="Email (login)">
                      <input name="email" type="email" required className={inputClass} placeholder="client@company.co.za" />
                    </Field>
                    <Field label="Password">
                      <input name="password" type="password" required minLength={8} className={inputClass} placeholder="••••••••" />
                    </Field>
                  </div>
                  <PrimaryButton type="submit">Create portal access</PrimaryButton>
                </form>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
