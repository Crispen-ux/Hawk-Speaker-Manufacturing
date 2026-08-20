import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { formatDate, formatMoney } from "@/lib/money";

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
  docTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0E2A47" },
  companyBlock: { alignItems: "flex-end", maxWidth: 240 },
  companyNameRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  logo: {
    maxWidth: 90,
    maxHeight: 22,
    marginRight: 7,
    objectFit: "contain",
  },
  companyName: { fontFamily: "Helvetica-Bold", fontSize: 12, color: "#0E2A47" },
  small: { fontSize: 9, color: "#5B6472", textAlign: "right" },
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
  colDate: { width: 70 },
  colDesc: { flex: 1 },
  colStatus: { width: 70 },
  colCharge: { width: 75, textAlign: "right" },
  colPaid: { width: 75, textAlign: "right" },
  colBalance: { width: 75, textAlign: "right" },
  thText: { fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: "#5B6472" },
  mono: { fontFamily: "Courier" },
  totalsBlock: { marginTop: 16, alignSelf: "flex-end", width: 240 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { color: "#5B6472" },
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

export type StatementRow = {
  date: string;
  number: string;
  status: string;
  total: number;
  paid: number;
};

export default function StatementPDF({
  client,
  fromDate,
  toDate,
  rows,
  company,
}: {
  client: { name: string; email?: string | null; address?: string | null };
  fromDate: string;
  toDate: string;
  rows: StatementRow[];
  company: {
    companyName: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    logoData?: string | null;
  };
}) {
  const totalCharged = rows.reduce((s, r) => s + r.total, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const outstanding = Math.max(totalCharged - totalPaid, 0);

  return (
    <Document title={`Statement — ${client.name}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>Statement of account</Text>
            <Text style={styles.docTitle}>{client.name}</Text>
          </View>
          <View style={styles.companyBlock}>
            <View style={styles.companyNameRow}>
              {company.logoData ? <Image style={styles.logo} src={company.logoData} /> : null}
              <Text style={styles.companyName}>{company.companyName}</Text>
            </View>
            {company.address ? <Text style={styles.small}>{company.address}</Text> : null}
            {company.email ? <Text style={styles.small}>{company.email}</Text> : null}
            {company.phone ? <Text style={styles.small}>{company.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Period</Text>
            <Text style={styles.metaValue}>
              {formatDate(fromDate)} — {formatDate(toDate)}
            </Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Client</Text>
            {client.email ? <Text style={styles.metaValue}>{client.email}</Text> : null}
            {client.address ? <Text style={styles.metaValue}>{client.address}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.colDate, styles.thText]}>Date</Text>
            <Text style={[styles.colDesc, styles.thText]}>Invoice</Text>
            <Text style={[styles.colStatus, styles.thText]}>Status</Text>
            <Text style={[styles.colCharge, styles.thText]}>Charged</Text>
            <Text style={[styles.colPaid, styles.thText]}>Paid</Text>
            <Text style={[styles.colBalance, styles.thText]}>Balance</Text>
          </View>
          {rows.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={{ color: "#5B6472" }}>No invoices in this period.</Text>
            </View>
          ) : (
            rows.map((r, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.colDate, styles.mono]}>{formatDate(r.date)}</Text>
                <Text style={styles.colDesc}>{r.number}</Text>
                <Text style={styles.colStatus}>{r.status}</Text>
                <Text style={[styles.colCharge, styles.mono]}>{formatMoney(r.total)}</Text>
                <Text style={[styles.colPaid, styles.mono]}>{formatMoney(r.paid)}</Text>
                <Text style={[styles.colBalance, styles.mono]}>{formatMoney(Math.max(r.total - r.paid, 0))}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total charged</Text>
            <Text style={styles.mono}>{formatMoney(totalCharged)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total paid</Text>
            <Text style={styles.mono}>{formatMoney(totalPaid)}</Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Outstanding</Text>
            <Text style={styles.grandValue}>{formatMoney(outstanding)}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {company.companyName} · Statement for {client.name}
        </Text>
      </Page>
    </Document>
  );
}
