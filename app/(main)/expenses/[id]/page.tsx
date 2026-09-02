import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { expenses } from "@/db/schema";
import { deleteExpense, setExpenseStatus } from "@/lib/actions/expenses";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import ConfirmForm from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

const VAT_LABELS: Record<string, string> = {
  standard: "Standard",
  zero_rated: "Zero-rated",
  exempt: "Exempt",
};

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expenseId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const [expense] = await db.query.expenses.findMany({
    where: eq(expenses.id, expenseId),
    with: { supplier: true, jobCard: true, approvedBy: true },
  });
  if (!expense) notFound();
  const remove = deleteExpense.bind(null, expenseId);
  const approve = setExpenseStatus.bind(null, expenseId, "approved");
  const reject = setExpenseStatus.bind(null, expenseId, "rejected");
  const resubmit = setExpenseStatus.bind(null, expenseId, "submitted");

  return (
    <div>
      <PageHeader
        eyebrow={expense.category || "Expense"}
        title={expense.description}
        action={
          <div className="flex items-center gap-2">
            {expense.status === "submitted" && (
              <>
                <form action={approve}>
                  <button type="submit" className="rounded-md bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-2">Approve</button>
                </form>
                <form action={reject}>
                  <button type="submit" className="rounded-md border border-rust px-3 py-1.5 text-xs font-medium text-rust hover:bg-red-50">Reject</button>
                </form>
              </>
            )}
            {expense.status !== "submitted" && (
              <form action={resubmit}>
                <button type="submit" className="rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper-dim">Revoke to submitted</button>
              </form>
            )}
            <GhostLink href={`/expenses/${expenseId}/edit`}>Edit</GhostLink>
            <a href={`/api/expenses/pdf/${expenseId}`} target="_blank" className="font-mono text-xs text-forest hover:underline">
              PDF
            </a>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusStamp status={expense.status} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Amount</div>
                <div className="text-ink">{money(expense.amount)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Date</div>
                <div className="text-ink">{formatDate(expense.date)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Category</div>
                <div className="text-ink">{expense.category || "—"}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">VAT</div>
                <div className="text-ink">{VAT_LABELS[expense.vatTreatment] ?? expense.vatTreatment}</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-rule pt-4 text-sm text-ink-soft">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Supplier</div>
                <div>{expense.supplier?.name || "—"}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Payment method</div>
                <div>{expense.paymentMethod || "—"}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Reference</div>
                <div className="font-mono">{expense.reference || "—"}</div>
              </div>
              {expense.jobCard && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Job card</div>
                  <Link href={`/job-cards/${expense.jobCardId}`} className="text-forest hover:underline">
                    {expense.jobCard.number} — {expense.jobCard.title}
                  </Link>
                </div>
              )}
              {expense.approvedBy && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Approved by</div>
                  <div>{expense.approvedBy.name ?? expense.approvedBy.email}</div>
                </div>
              )}
              {expense.approvedAt && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Approved at</div>
                  <div className="font-mono">{formatDate(expense.approvedAt)}</div>
                </div>
              )}
            </div>
            {expense.notes && <div className="mt-4 text-sm text-ink-soft">{expense.notes}</div>}
          </Card>
        </div>

        <div className="space-y-6">
          <ConfirmForm action={remove} confirm="Delete this expense? This can't be undone.">
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete expense
            </button>
          </ConfirmForm>
        </div>
      </div>
    </div>
  );
}
