import Link from "next/link";
import { db } from "@/db";
import { invoices, quotations, creditNotes, receipts, deliveryNotes, uploads, clients } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { PageHeader, Card, Field, inputClass, PrimaryButton } from "@/components/ui";
import ConfirmForm from "@/components/ConfirmForm";
import { uploadDocument, deleteUpload, updateUpload } from "@/lib/actions/documents";
import { formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

type DepotRow = {
  kind: string;
  label: string;
  number: string;
  clientName: string;
  date: string;
  href: string;
  pdfHref: string;
};

const CATEGORIES = ["contract", "compliance", "insurance", "finance", "other"];
const CATEGORY_LABELS: Record<string, string> = {
  contract: "Contract",
  compliance: "Compliance",
  insurance: "Insurance",
  finance: "Finance",
  other: "Other",
};
const VISIBILITY_LABELS: Record<string, string> = {
  internal: "Internal only",
  client: "Client only",
  both: "Client + internal",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const [invList, quoList, cnList, rctList, dnList, upList, allClients] = await Promise.all([
    db
      .select({ id: invoices.id, number: invoices.number, issueDate: invoices.issueDate, clientId: invoices.clientId })
      .from(invoices)
      .orderBy(desc(invoices.createdAt))
      .limit(200),
    db
      .select({ id: quotations.id, number: quotations.number, issueDate: quotations.issueDate, clientId: quotations.clientId })
      .from(quotations)
      .orderBy(desc(quotations.createdAt))
      .limit(200),
    db
      .select({ id: creditNotes.id, number: creditNotes.number, issueDate: creditNotes.issueDate, clientId: creditNotes.clientId })
      .from(creditNotes)
      .orderBy(desc(creditNotes.createdAt))
      .limit(200),
    db
      .select({ id: receipts.id, number: receipts.number, issueDate: receipts.issueDate, clientId: receipts.clientId })
      .from(receipts)
      .orderBy(desc(receipts.createdAt))
      .limit(200),
    db
      .select({ id: deliveryNotes.id, number: deliveryNotes.number, deliveryDate: deliveryNotes.deliveryDate, clientId: deliveryNotes.clientId })
      .from(deliveryNotes)
      .orderBy(desc(deliveryNotes.createdAt))
      .limit(200),
    db.select().from(uploads).orderBy(desc(uploads.createdAt)),
    db.select().from(clients).orderBy(clients.name),
  ]);

  const clientIds = Array.from(new Set([...invList, ...quoList, ...cnList, ...rctList, ...dnList].map((r) => r.clientId)));
  const clientRows = clientIds.length ? await db.select().from(clients).where(inArray(clients.id, clientIds)) : [];
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));
  const clientNameAll = new Map(allClients.map((c) => [c.id, c.name]));

  const rows: DepotRow[] = [
    ...invList.map((r) => ({ kind: "Invoice", label: "invoice", number: r.number, clientName: clientName.get(r.clientId) ?? "", date: r.issueDate, href: `/invoices/${r.id}`, pdfHref: `/api/invoices/pdf/${r.id}` })),
    ...quoList.map((r) => ({ kind: "Quotation", label: "quotation", number: r.number, clientName: clientName.get(r.clientId) ?? "", date: r.issueDate, href: `/quotations/${r.id}`, pdfHref: `/api/quotations/pdf/${r.id}` })),
    ...cnList.map((r) => ({ kind: "Credit note", label: "creditNote", number: r.number, clientName: clientName.get(r.clientId) ?? "", date: r.issueDate, href: `/credit-notes/${r.id}`, pdfHref: `/api/credit-notes/pdf/${r.id}` })),
    ...rctList.map((r) => ({ kind: "Receipt", label: "receipt", number: r.number, clientName: clientName.get(r.clientId) ?? "", date: r.issueDate, href: `/receipts/${r.id}`, pdfHref: `/api/receipts/pdf/${r.id}` })),
    ...dnList.map((r) => ({ kind: "Delivery note", label: "deliveryNote", number: r.number, clientName: clientName.get(r.clientId) ?? "", date: r.deliveryDate, href: `/delivery-notes/${r.id}`, pdfHref: `/api/delivery-notes/pdf/${r.id}` })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const filteredUploads = category && category !== "all" ? upList.filter((u) => u.category === category) : upList;

  return (
    <div>
      <PageHeader eyebrow="Docs" title="Document depot" />

      <Card className="max-w-3xl">
        <h2 className="mb-1 font-display text-lg font-bold text-navy">Upload a file</h2>
        <p className="mb-4 text-xs text-ink-soft">
          Store files (receipts, signed docs, photos) in the depot. Limit 4 MB per file. Set visibility to share with a client via the portal.
        </p>
        <form action={uploadDocument} className="space-y-4">
          <Field label="Label">
            <input name="label" required className={inputClass} placeholder="e.g. Signed contract – Acme" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Category">
              <select name="category" defaultValue="" className={inputClass}>
                <option value="">None</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </Field>
            <Field label="Client (optional)">
              <select name="clientId" defaultValue="" className={inputClass}>
                <option value="">— None —</option>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Visibility">
              <select name="visibility" defaultValue="internal" className={inputClass}>
                <option value="internal">Internal only</option>
                <option value="client">Client only</option>
                <option value="both">Client + internal</option>
              </select>
            </Field>
          </div>
          <Field label="File">
            <input type="file" name="file" required className={inputClass} />
          </Field>
          <PrimaryButton type="submit">Upload</PrimaryButton>
        </form>
      </Card>

      <h2 className="mt-10 mb-3 font-display text-lg font-bold text-navy">Generated documents ({rows.length})</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No documents generated yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 text-right font-medium">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.label}-${r.number}`} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-2.5">{r.kind}</td>
                  <td className="px-4 py-2.5">
                    <Link href={r.href} className="font-mono font-medium text-ink hover:text-forest">
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">{r.clientName || "—"}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{formatDate(r.date)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a href={r.pdfHref} target="_blank" className="font-mono text-xs text-forest hover:underline">
                      download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-10 mb-3 font-display text-lg font-bold text-navy">Uploaded files ({upList.length})</h2>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/documents"
          className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
            !category || category === "all"
              ? "border-forest bg-forest text-paper"
              : "border-rule-strong text-ink-soft hover:bg-paper-dim"
          }`}
        >
          all
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/documents?category=${c}`}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
              category === c ? "border-forest bg-forest text-paper" : "border-rule-strong text-ink-soft hover:bg-paper-dim"
            }`}
          >
            {CATEGORY_LABELS[c]}
          </Link>
        ))}
      </div>

      {filteredUploads.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing uploaded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Label</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Visibility</th>
                <th className="px-4 py-2.5 font-medium">File</th>
                <th className="px-4 py-2.5 text-right font-medium">Size</th>
                <th className="px-4 py-2.5 font-medium">Uploaded</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUploads.map((u) => {
                const remove = deleteUpload.bind(null, u.id);
                const update = updateUpload.bind(null, u.id);
                return (
                  <tr key={u.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                    <td className="px-4 py-2.5 font-medium text-ink">{u.label}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{u.category ? (CATEGORY_LABELS[u.category] ?? u.category) : "—"}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{u.clientId ? (clientNameAll.get(u.clientId) ?? "—") : "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-paper-dim text-ink-soft">
                        {VISIBILITY_LABELS[u.visibility] ?? u.visibility}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-soft">{u.fileName}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-ink-soft">
                      {u.size > 1024 * 1024 ? `${(u.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(u.size / 1024))} KB`}
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{formatDate(u.createdAt.toISOString())}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-3">
                        <details className="relative">
                          <summary className="cursor-pointer font-mono text-xs text-ink hover:underline">Edit</summary>
                          <div className="absolute right-0 z-10 mt-2 w-80 rounded-md border border-rule bg-white p-4 shadow-lg">
                            <form action={update} className="space-y-3">
                              <Field label="Label">
                                <input name="label" defaultValue={u.label} required className={inputClass} />
                              </Field>
                              <Field label="Category">
                                <select name="category" defaultValue={u.category ?? ""} className={inputClass}>
                                  <option value="">None</option>
                                  {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Client">
                                <select name="clientId" defaultValue={u.clientId ?? ""} className={inputClass}>
                                  <option value="">— None —</option>
                                  {allClients.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Visibility">
                                <select name="visibility" defaultValue={u.visibility} className={inputClass}>
                                  <option value="internal">Internal only</option>
                                  <option value="client">Client only</option>
                                  <option value="both">Client + internal</option>
                                </select>
                              </Field>
                              <PrimaryButton type="submit">Save</PrimaryButton>
                            </form>
                          </div>
                        </details>
                        <a href={`/api/documents/download/${u.id}`} className="font-mono text-xs text-forest hover:underline">
                          download
                        </a>
                        <ConfirmForm action={remove} confirm="Delete this upload permanently? This can't be undone.">
                          <button className="font-mono text-xs text-rust hover:underline">remove</button>
                        </ConfirmForm>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
