import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { formatDate, formatMoney, toNumber } from "@/lib/money";

const styles = StyleSheet.create({
  page: {
    padding: 44,
    paddingTop: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#16212E",
  },
  accentBar: {
    height: 4,
    backgroundColor: "#12B8C4",
    marginBottom: 24,
    marginHorizontal: -44,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  kicker: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#5B6472",
    marginBottom: 4,
  },
  docTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#0E2A47",
  },
  docNumber: {
    fontFamily: "Courier",
    fontSize: 11,
    marginTop: 2,
    color: "#5B6472",
  },
  companyBlock: {
    alignItems: "flex-end",
    maxWidth: 220,
  },
  logo: {
    maxWidth: 140,
    maxHeight: 56,
    marginBottom: 8,
    objectFit: "contain",
  },
  companyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    marginBottom: 2,
    color: "#0E2A47",
  },
  small: {
    fontSize: 9,
    color: "#5B6472",
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E5EA",
  },
  metaBlock: { maxWidth: 240 },
  metaLabel: {
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#5B6472",
    marginBottom: 3,
  },
  metaValue: { fontSize: 10.5, marginBottom: 2 },
  table: { marginTop: 6 },
  tableHeadRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0E2A47",
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E5EA",
  },
  colDesc: { flex: 1 },
  colQty: { width: 50, textAlign: "right" },
  colUnit: { width: 80, textAlign: "right" },
  colTotal: { width: 80, textAlign: "right" },
  thText: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#5B6472",
  },
  totalsBlock: {
    marginTop: 16,
    alignSelf: "flex-end",
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: { color: "#5B6472" },
  totalsValueMono: { fontFamily: "Courier" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: "#0E2A47",
  },
  grandLabel: { fontFamily: "Helvetica-Bold", fontSize: 11, color: "#0E2A47" },
  grandValue: { fontFamily: "Courier-Bold", fontSize: 11, color: "#0E2A47" },
  notes: {
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: "#E2E5EA",
    fontSize: 9,
    color: "#5B6472",
    lineHeight: 1.5,
  },
  stamp: {
    marginTop: 4,
    fontFamily: "Courier-Bold",
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#0E2A47",
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 44,
    right: 44,
    fontSize: 8,
    color: "#5B6472",
    textAlign: "center",
  },
});

type Item = { description: string; quantity: string; unitPrice: string };

const STATUS_COLOR: Record<string, string> = {
  draft: "#5B6472",
  sent: "#0E93A8",
  paid: "#1F8A5A",
  partial: "#12B8C4",
  overdue: "#C0392B",
  cancelled: "#5B6472",
  accepted: "#1F8A5A",
  declined: "#C0392B",
  expired: "#5B6472",
};

export type DocPDFProps = {
  kind: "Invoice" | "Quotation";
  number: string;
  status: string;
  issueDate: string;
  dueOrExpiryLabel: string;
  dueOrExpiryDate: string;
  client: { name: string; email?: string | null; address?: string | null };
  items: Item[];
  taxRate: string;
  discount: string;
  notes?: string | null;
  paid?: number;
  company: {
    companyName: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    bankDetails?: string | null;
    logoData?: string | null;
  };
};

export default function DocPDF({
  kind,
  number,
  status,
  issueDate,
  dueOrExpiryLabel,
  dueOrExpiryDate,
  client,
  items,
  taxRate,
  discount,
  notes,
  paid,
  company,
}: DocPDFProps) {
  const subtotal = items.reduce((s, it) => s + toNumber(it.quantity) * toNumber(it.unitPrice), 0);
  const afterDiscount = Math.max(subtotal - toNumber(discount), 0);
  const tax = afterDiscount * (toNumber(taxRate) / 100);
  const total = afterDiscount + tax;
  const balance = paid !== undefined ? Math.max(total - paid, 0) : undefined;

  return (
    <Document title={`${kind} ${number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>{kind}</Text>
            <Text style={styles.docTitle}>{number}</Text>
            <Text style={[styles.stamp, { color: STATUS_COLOR[status] ?? "#0E2A47" }]}>{status}</Text>
          </View>
          <View style={styles.companyBlock}>
            {company.logoData ? <Image style={styles.logo} src={company.logoData} /> : null}
            <Text style={styles.companyName}>{company.companyName}</Text>
            {company.address ? <Text style={styles.small}>{company.address}</Text> : null}
            {company.email ? <Text style={styles.small}>{company.email}</Text> : null}
            {company.phone ? <Text style={styles.small}>{company.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Billed to</Text>
            <Text style={styles.metaValue}>{client.name}</Text>
            {client.email ? <Text style={styles.metaValue}>{client.email}</Text> : null}
            {client.address ? <Text style={styles.metaValue}>{client.address}</Text> : null}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Issued</Text>
            <Text style={styles.metaValue}>{formatDate(issueDate)}</Text>
            <Text style={[styles.metaLabel, { marginTop: 8 }]}>{dueOrExpiryLabel}</Text>
            <Text style={styles.metaValue}>{formatDate(dueOrExpiryDate)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.colDesc, styles.thText]}>Description</Text>
            <Text style={[styles.colQty, styles.thText]}>Qty</Text>
            <Text style={[styles.colUnit, styles.thText]}>Unit price</Text>
            <Text style={[styles.colTotal, styles.thText]}>Total</Text>
          </View>
          {items.map((it, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{it.description}</Text>
              <Text style={[styles.colQty, { fontFamily: "Courier" }]}>{it.quantity}</Text>
              <Text style={[styles.colUnit, { fontFamily: "Courier" }]}>{formatMoney(it.unitPrice)}</Text>
              <Text style={[styles.colTotal, { fontFamily: "Courier" }]}>
                {formatMoney(toNumber(it.quantity) * toNumber(it.unitPrice))}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValueMono}>{formatMoney(subtotal)}</Text>
          </View>
          {toNumber(discount) > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValueMono}>-{formatMoney(discount)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax ({toNumber(taxRate)}%)</Text>
            <Text style={styles.totalsValueMono}>{formatMoney(tax)}</Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>{formatMoney(total)}</Text>
          </View>
          {paid !== undefined && paid > 0 && (
            <>
              <View style={[styles.totalsRow, { marginTop: 6 }]}>
                <Text style={styles.totalsLabel}>Paid</Text>
                <Text style={styles.totalsValueMono}>{formatMoney(paid)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { fontFamily: "Helvetica-Bold", color: "#16212E" }]}>
                  Balance due
                </Text>
                <Text style={[styles.totalsValueMono, { fontFamily: "Courier-Bold" }]}>
                  {formatMoney(balance)}
                </Text>
              </View>
            </>
          )}
        </View>

        {notes ? (
          <View style={styles.notes}>
            <Text>{notes}</Text>
          </View>
        ) : null}

        {company.bankDetails ? (
          <View style={styles.notes}>
            <Text style={styles.metaLabel}>Payment details</Text>
            <Text>{company.bankDetails}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          {company.companyName} · {kind} {number}
        </Text>
      </Page>
    </Document>
  );
}
