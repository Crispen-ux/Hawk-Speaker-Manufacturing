import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { formatDate, formatMoney } from "@/lib/money";
import type { DocPDFProps } from "@/components/pdf/DocPDF";

const styles = StyleSheet.create({
  page: {
    padding: 44,
    paddingTop: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#16212E",
  },
  accentBar: { height: 4, backgroundColor: "#12B8C4", marginBottom: 24, marginHorizontal: -44 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  kicker: { fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "#5B6472", marginBottom: 4 },
  docTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0E2A47" },
  docMeta: { fontFamily: "Courier", fontSize: 11, marginTop: 2, color: "#5B6472" },
  companyBlock: { alignItems: "flex-end", maxWidth: 240 },
  logoWrap: { flexDirection: "row", justifyContent: "flex-end", marginRight: -10 },
  logo: { maxWidth: 110, maxHeight: 36, marginBottom: 7, objectFit: "contain" },
  companyName: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 2 },
  companyLine: { fontSize: 9, color: "#5B6472" },
  intro: { marginBottom: 20 },
  introText: { marginTop: 8, fontSize: 9.5, color: "#414B5A", lineHeight: 1.5 },
  table: { width: "100%", borderTopWidth: 1, borderTopColor: "#D8DEE6" },
  thead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#D8DEE6", paddingVertical: 6, backgroundColor: "#F4F6F8" },
  th: { fontSize: 7.5, letterSpacing: 1, textTransform: "uppercase", color: "#5B6472" },
  headDesc: { width: "42%" },
  headQty: { width: "10%", textAlign: "right" },
  headCost: { width: "16%", textAlign: "right" },
  headMarkup: { width: "12%", textAlign: "right" },
  headVat: { width: "10%" },
  headLine: { width: "10%", textAlign: "right" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EEF1F5", paddingVertical: 7 },
  td: { fontSize: 9.5 },
  desc: { width: "42%" },
  qty: { width: "10%", textAlign: "right" },
  cost: { width: "16%", textAlign: "right" },
  markup: { width: "12%", textAlign: "right" },
  vat: { width: "10%" },
  line: { width: "10%", textAlign: "right" },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  totalLabel: { fontSize: 10, color: "#414B5A" },
  totalValue: { fontFamily: "Helvetica-Bold", fontSize: 12, marginLeft: 40, minWidth: 90, textAlign: "right" },
});

const VAT_LABELS: Record<string, string> = {
  standard: "Std",
  zero_rated: "0%",
  exempt: "Exempt",
};

export type BomPdfItem = {
  description: string;
  quantity: string;
  unitCost: string;
  markup: string;
  vatTreatment: string;
};

export default function BomPDF({
  name,
  createdAt,
  description,
  items,
  company,
  currency = "R",
}: {
  name: string;
  createdAt?: Date | string | null;
  description?: string | null;
  items: BomPdfItem[];
  company: DocPDFProps["company"];
  currency?: string;
}) {
  const money = (v: string | number | null | undefined) => formatMoney(v, currency || "R");
  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost) * (1 + Number(it.markup) / 100), 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>Bill of materials</Text>
            <Text style={styles.docTitle}>{name}</Text>
            {createdAt && <Text style={styles.docMeta}>{formatDate(String(createdAt).slice(0, 10))}</Text>}
          </View>
          <View style={styles.companyBlock}>
            {company.logoData ? (
              <View style={styles.logoWrap}>
                <Image src={company.logoData} style={styles.logo} />
              </View>
            ) : null}
            <Text style={styles.companyName}>{company.companyName}</Text>
            {company.registrationNumber && <Text style={styles.companyLine}>Reg: {company.registrationNumber}</Text>}
            {company.address && <Text style={styles.companyLine}>{company.address}</Text>}
          </View>
        </View>

        {description ? (
          <View style={styles.intro}>
            <Text style={styles.introText}>{description}</Text>
          </View>
        ) : null}

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.headDesc]}>Component</Text>
            <Text style={[styles.th, styles.headQty]}>Qty</Text>
            <Text style={[styles.th, styles.headCost]}>Unit cost</Text>
            <Text style={[styles.th, styles.headMarkup]}>Markup</Text>
            <Text style={[styles.th, styles.headVat]}>VAT</Text>
            <Text style={[styles.th, styles.headLine]}>Line total</Text>
          </View>
          {items.map((it, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.td, styles.desc]}>{it.description}</Text>
              <Text style={[styles.td, styles.qty]}>{Number(it.quantity)}</Text>
              <Text style={[styles.td, styles.cost]}>{money(it.unitCost)}</Text>
              <Text style={[styles.td, styles.markup]}>{Number(it.markup)}%</Text>
              <Text style={[styles.td, styles.vat]}>{VAT_LABELS[it.vatTreatment] ?? it.vatTreatment}</Text>
              <Text style={[styles.td, styles.line]}>{money(Number(it.quantity) * Number(it.unitCost) * (1 + Number(it.markup) / 100))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsRow}>
          <Text style={styles.totalLabel}>Total cost</Text>
          <Text style={styles.totalValue}>{money(total)}</Text>
        </View>
      </Page>
    </Document>
  );
}
