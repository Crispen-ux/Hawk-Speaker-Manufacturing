import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { expenses } from "@/db/schema";
import { deleteExpense } from "@/lib/actions/expenses";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, GhostLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expenseId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const [expense] = await db.query.expenses.findMany({ where: eq(expenses.id, expenseId), with: { supplier: true } });
  if (!expense) notFound();
  const remove = deleteExpense.bind(null, expenseId);

  return (
    <div>
      <PageHeader
        eyebrow={expense.category || "Expense"}
        title={expense.description}
        action={
          <div className="flex items-center gap-2">
            <GhostLink href={`/expenses/${expenseId}/edit`}>Edit</GhostLink>
            <a href={`/api/expenses/pdf/${expenseId}`} target="_blank" className="font-mono text-xs text-forest hover:underline">
              download PDF
            </a>
          </div>
        }
      />

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
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Paid via</div>
                <div className="text-ink">{expense.paymentMethod || "—"}</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-rule pt-4 text-sm text-ink-soft">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Supplier</div>
                <div>{expense.supplier?.name || "—"}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Reference</div>
                <div className="font-mono">{expense.reference || "—"}</div>
              </div>
            </div>
            {expense.notes && <div className="mt-4 text-sm text-ink-soft">{expense.notes}</div>}
          </Card>
        </div>

        <div className="space-y-6">
          <form action={remove}>
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete expense
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}