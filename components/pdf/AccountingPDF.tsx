import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { formatDate, formatMoney } from "@/lib/money";
import type { IncomeStatement } from "@/lib/ledger";
import type { BalanceSheet } from "@/lib/ledger";

export type PdfCompany = {
  companyName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoData?: string | null;
  registrationNumber?: string | null;
  vatNumber?: string | null;
  currency?: string;
};

export type TbRow = { code: string; name: string; debit: number; credit: number };
export type TbGroup = { label: string; rows: TbRow[]; debit: number; credit: number };

const styles = StyleSheet.create({
  page: {
    padding: 44,
    paddingTop: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#16212E",
  },
  accentBar: { height: 4, backgroundColor: "#12B8C4", marginBottom: 24, marginHorizontal: -44 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 },
  kicker: { fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "#5B6472", marginBottom: 4 },
  docTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0E2A47" },
  meta: { fontSize: 9.5, color: "#5B6472", marginTop: 4 },
  companyBlock: { alignItems: "flex-end", maxWidth: 240 },
  logo: { maxWidth: 110, maxHeight: 32, marginBottom: 7, objectFit: "contain" },
  companyName: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 2, color: "#0E2A47" },
  small: { fontSize: 9, color: "#5B6472", textAlign: "right" },
  table: { marginTop: 4 },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#5B6472",
    marginTop: 14,
    marginBottom: 4,
  },
  tableHeadRow: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "#0E2A47", paddingBottom: 6, marginBottom: 4 },
  thText: { fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: "#5B6472" },
  tableRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#E2E5EA" },
  mono: { fontFamily: "Courier" },
  groupRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#E2E5EA", backgroundColor: "#F1F4F8" },
  colAccount: { flex: 1 },
  colCode: { width: 44 },
  colAmount: { width: 90, textAlign: "right" },
  colDebit: { width: 90, textAlign: "right" },
  colCredit: { width: 90, textAlign: "right" },
  tblGroupLabel: { fontFamily: "Helvetica-Bold", fontSize: 9, textTransform: "uppercase", color: "#0E2A47" },
  grandRow: {
    flexDirection: "row",
    marginTop: 8,
    paddingVertical: 7,
    borderTopWidth: 2,
    borderTopColor: "#0E2A47",
    backgroundColor: "#0E2A47",
  },
  grandLabel: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 10, textTransform: "uppercase", color: "#FFFFFF" },
  grandValue: { width: 90, textAlign: "right", fontFamily: "Courier-Bold", fontSize: 10, color: "#FFFFFF" },
  jTotalRow: { flexDirection: "row", marginTop: 8, paddingVertical: 7, borderTopWidth: 2, borderTopColor: "#0E2A47", backgroundColor: "#0E2A47" },
  jTotalLabel: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 10, textTransform: "uppercase", color: "#FFFFFF" },
  jTotalValue: { width: 80, textAlign: "right", fontFamily: "Courier-Bold", fontSize: 10, color: "#FFFFFF" },
  colJNumber: { width: 56 },
  colJDate: { width: 62 },
  colJKind: { width: 48 },
  totalsRow: { flexDirection: "row", paddingVertical: 4 },
  totalsLabel: { flex: 1, color: "#5B6472" },
  totalsValue: { width: 90, textAlign: "right", fontFamily: "Courier" },
  bold: { fontFamily: "Helvetica-Bold", color: "#0E2A47" },
  balanced: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#0E2A47",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  balancedLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, color: "#0E2A47" },
  balancedValue: { fontFamily: "Courier-Bold", fontSize: 10, color: "#0E2A47" },
  footer: { position: "absolute", bottom: 32, left: 44, right: 44, fontSize: 8, color: "#5B6472", textAlign: "center" },
});

function Header({
  kicker,
  title,
  meta,
  company,
}: {
  kicker: string;
  title: string;
  meta: string;
  company: PdfCompany;
}) {
  return (
    <>
      <View style={styles.accentBar} />
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={styles.meta}>{meta}</Text>
        </View>
        <View style={styles.companyBlock}>
          {company.logoData ? <Image style={styles.logo} src={company.logoData} /> : null}
          <Text style={styles.companyName}>{company.companyName}</Text>
          {company.registrationNumber ? <Text style={styles.small}>Reg: {company.registrationNumber}</Text> : null}
          {company.vatNumber ? <Text style={styles.small}>VAT: {company.vatNumber}</Text> : null}
          {company.address ? <Text style={styles.small}>{company.address}</Text> : null}
          {company.email ? <Text style={styles.small}>{company.email}</Text> : null}
          {company.phone ? <Text style={styles.small}>{company.phone}</Text> : null}
        </View>
      </View>
    </>
  );
}

const moneyFor = (currency: string) => (v: number) => formatMoney(v, currency || "R");
const asOfLabel = (d?: string) => (d ? `As at ${formatDate(d)}` : "As at today");

// ---------- Trial balance ----------

export function TrialBalancePDF({
  asOf,
  groups,
  totalDebits,
  totalCredits,
  company,
  currency,
}: {
  asOf?: string;
  groups: TbGroup[];
  totalDebits: number;
  totalCredits: number;
  company: PdfCompany;
  currency?: string;
}) {
  const money = moneyFor(currency ?? "");
  return (
    <Document title="Trial balance">
      <Page size="A4" style={styles.page}>
        <Header kicker="General ledger" title="Trial balance" meta={asOfLabel(asOf)} company={company} />
        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.colAccount, styles.thText]}>Account</Text>
            <Text style={[styles.colDebit, styles.thText]}>Debit</Text>
            <Text style={[styles.colCredit, styles.thText]}>Credit</Text>
          </View>
          {groups.map((g) => (
            <View key={g.label}>
              {g.rows.map((r) => (
                <View key={r.code} style={styles.tableRow}>
                  <Text style={styles.colAccount}>
                    <Text style={styles.mono}>{r.code}  </Text>
                    <Text>{r.name}</Text>
                  </Text>
                  <Text style={[styles.colDebit, styles.mono]}>{r.debit > 0 ? money(r.debit) : ""}</Text>
                  <Text style={[styles.colCredit, styles.mono]}>{r.credit > 0 ? money(r.credit) : ""}</Text>
                </View>
              ))}
              <View style={styles.groupRow}>
                <Text style={[styles.colAccount, styles.tblGroupLabel]}>{g.label} total</Text>
                <Text style={[styles.colDebit, styles.mono]}>{g.debit > 0 ? money(g.debit) : ""}</Text>
                <Text style={[styles.colCredit, styles.mono]}>{g.credit > 0 ? money(g.credit) : ""}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>{money(totalDebits)}</Text>
          <Text style={styles.grandValue}>{money(totalCredits)}</Text>
        </View>
        <Text style={styles.footer} fixed>
          {company.companyName} · Trial balance · Debits equal credits: {Math.abs(totalDebits - totalCredits) < 0.01 ? "balanced" : "out of balance"}
        </Text>
      </Page>
    </Document>
  );
}

// ---------- Income statement ----------

export function IncomeStatementPDF({
  from,
  to,
  stmt,
  company,
  currency,
}: {
  from: string;
  to: string;
  stmt: IncomeStatement;
  company: PdfCompany;
  currency?: string;
}) {
  const money = moneyFor(currency ?? "");
  const renderLine = (label: string, amount: number, bold?: boolean) => (
    <View style={bold ? styles.groupRow : styles.tableRow}>
      <Text style={[styles.colAccount, bold ? styles.tblGroupLabel : {}]}>{label}</Text>
      <Text style={[styles.colAmount, styles.mono, bold ? styles.bold : {}]}>{money(amount)}</Text>
    </View>
  );

  return (
    <Document title="Income statement">
      <Page size="A4" style={styles.page}>
        <Header kicker="Profit & loss" title="Income statement" meta={`${formatDate(from)} — ${formatDate(to)}`} company={company} />
        <View style={styles.table}>
          <Text style={styles.sectionLabel}>Revenue</Text>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.colAccount, styles.thText]}>Line</Text>
            <Text style={[styles.colAmount, styles.thText]}>Amount</Text>
          </View>
          {stmt.revenue.length === 0 ? renderLine("No revenue in this period", 0) : stmt.revenue.map((l) => renderLine(`${l.code ? l.code + "  " : ""}${l.label}`, l.amount))}
          {renderLine("Total revenue", stmt.revenueTotal, true)}
          <Text style={styles.sectionLabel}>Expenses</Text>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.colAccount, styles.thText]}>Line</Text>
            <Text style={[styles.colAmount, styles.thText]}>Amount</Text>
          </View>
          {stmt.expenses.length === 0 ? renderLine("No expenses in this period", 0) : stmt.expenses.map((l) => renderLine(`${l.code ? l.code + "  " : ""}${l.label}`, l.amount))}
          {renderLine("Total expenses", stmt.expenseTotal, true)}
        </View>
        <View style={styles.balanced}>
          <Text style={styles.balancedLabel}>{stmt.netProfit >= 0 ? "Net profit" : "Net loss"}</Text>
          <Text style={styles.balancedValue}>{money(stmt.netProfit)}</Text>
        </View>
        <Text style={styles.footer} fixed>
          {company.companyName} · Income statement for the period {formatDate(from)} to {formatDate(to)}
        </Text>
      </Page>
    </Document>
  );
}

// ---------- Balance sheet ----------

export function BalanceSheetPDF({
  asOf,
  bs,
  company,
  currency,
}: {
  asOf: string;
  bs: BalanceSheet;
  company: PdfCompany;
  currency?: string;
}) {
  const money = moneyFor(currency ?? "");
  const renderSection = (title: string, lines: BalanceSheet["assets"], total: number) => (
    <View>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.tableHeadRow}>
        <Text style={[styles.colAccount, styles.thText]}>Line</Text>
        <Text style={[styles.colAmount, styles.thText]}>Amount</Text>
      </View>
      {lines.length === 0 ? (
        <View style={styles.tableRow}>
          <Text style={{ color: "#5B6472" }}>—</Text>
        </View>
      ) : (
        lines.map((l) => (
          <View key={`${l.code}-${l.label}`} style={styles.tableRow}>
            <Text style={styles.colAccount}>
              <Text style={styles.mono}>{l.code ? l.code + "  " : ""}</Text>
              <Text>{l.label}</Text>
            </Text>
            <Text style={[styles.colAmount, styles.mono]}>{money(l.amount)}</Text>
          </View>
        ))
      )}
      <View style={styles.groupRow}>
        <Text style={[styles.colAccount, styles.tblGroupLabel]}>Total {title}</Text>
        <Text style={[styles.colAmount, styles.mono, styles.bold]}>{money(total)}</Text>
      </View>
    </View>
  );

  const balanced = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 0.01;

  return (
    <Document title="Balance sheet">
      <Page size="A4" style={styles.page}>
        <Header kicker="Statement of financial position" title="Balance sheet" meta={asOfLabel(asOf)} company={company} />
        <View style={styles.table}>
          {renderSection("Assets", bs.assets, bs.totalAssets)}
          {renderSection("Liabilities", bs.liabilities, bs.totalLiabilities)}
          {renderSection("Equity", bs.equity, bs.totalEquity)}
        </View>
        <View style={styles.balanced}>
          <Text style={styles.balancedLabel}>
            Assets = Liabilities + Equity ({balanced ? "balanced" : "out of balance"})
          </Text>
          <Text style={styles.balancedValue}>{money(bs.totalAssets)}</Text>
        </View>
        <Text style={styles.footer} fixed>
          {company.companyName} · Balance sheet as at {formatDate(asOf)}
        </Text>
      </Page>
    </Document>
  );
}

// ---------- General journal ----------

export type JournalLinePdf = { accountCode: string; accountName: string; debit: number; credit: number };
export type JournalEntryPdf = {
  number: string;
  date: string | null;
  kind: "opening" | "manual";
  memo: string;
  reference?: string | null;
  lines: JournalLinePdf[];
};

export function JournalPDF({
  asOf,
  entries,
  totalDebits,
  totalCredits,
  company,
  currency,
}: {
  asOf?: string;
  entries: JournalEntryPdf[];
  totalDebits: number;
  totalCredits: number;
  company: PdfCompany;
  currency?: string;
}) {
  const money = moneyFor(currency ?? "");
  return (
    <Document title="General journal">
      <Page size="A4" style={styles.page}>
        <Header kicker="General ledger" title="General journal" meta={asOfLabel(asOf)} company={company} />
        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.colJNumber, styles.thText]}>Number</Text>
            <Text style={[styles.colJDate, styles.thText]}>Date</Text>
            <Text style={[styles.colJKind, styles.thText]}>Kind</Text>
            <Text style={[styles.colAccount, styles.thText]}>Account</Text>
            <Text style={[styles.colDebit, styles.thText]}>Debit</Text>
            <Text style={[styles.colCredit, styles.thText]}>Credit</Text>
          </View>
          {entries.map((e) => (
            <View key={e.number}>
              <View style={styles.groupRow}>
                <Text style={[styles.colJNumber, styles.mono]}>{e.number}</Text>
                <Text style={[styles.colJDate, styles.mono]}>{e.date ? formatDate(e.date) : ""}</Text>
                <Text style={[styles.colJKind, styles.tblGroupLabel]}>{e.kind}</Text>
                <Text style={[styles.colAccount, styles.tblGroupLabel]}>
                  {e.memo}
                  {e.reference ? `  ·  ${e.reference}` : ""}
                </Text>
                <Text style={[styles.colDebit, styles.mono]} />
                <Text style={[styles.colCredit, styles.mono]} />
              </View>
              {e.lines.map((l, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.colJNumber} />
                  <Text style={styles.colJDate} />
                  <Text style={styles.colJKind} />
                  <Text style={styles.colAccount}>
                    <Text style={styles.mono}>{l.accountCode}  </Text>
                    <Text>{l.accountName}</Text>
                  </Text>
                  <Text style={[styles.colDebit, styles.mono]}>{l.debit > 0 ? money(l.debit) : ""}</Text>
                  <Text style={[styles.colCredit, styles.mono]}>{l.credit > 0 ? money(l.credit) : ""}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={styles.jTotalRow}>
          <Text style={styles.jTotalLabel}>Total</Text>
          <Text style={styles.jTotalValue}>{money(totalDebits)}</Text>
          <Text style={styles.jTotalValue}>{money(totalCredits)}</Text>
        </View>
        <Text style={styles.footer} fixed>
          {company.companyName} · General journal · {entries.length} entries posted
        </Text>
      </Page>
    </Document>
  );
}