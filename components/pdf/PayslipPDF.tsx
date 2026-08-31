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
  docSub: {
    fontFamily: "Courier",
    fontSize: 11,
    marginTop: 2,
    color: "#5B6472",
  },
  stamp: {
    marginTop: 4,
    fontFamily: "Courier-Bold",
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#1F8A5A",
  },
  companyBlock: {
    alignItems: "flex-end",
    maxWidth: 240,
  },
  logoWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginRight: -10,
  },
  logo: {
    maxWidth: 110,
    maxHeight: 32,
    marginBottom: 7,
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
  metaBlock: { maxWidth: 260 },
  metaLabel: {
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#5B6472",
    marginBottom: 3,
  },
  metaValue: { fontSize: 10.5, marginBottom: 2 },
  sectionTitle: {
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#5B6472",
    marginBottom: 8,
    marginTop: 18,
  },
  table: {
    borderTopWidth: 1.5,
    borderTopColor: "#0E2A47",
    paddingTop: 6,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E5EA",
  },
  tableLabel: { fontSize: 10 },
  tableValue: { fontFamily: "Courier", fontSize: 10 },
  grossRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#0E2A47",
    marginTop: 4,
  },
  grossLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, color: "#0E2A47" },
  grossValue: { fontFamily: "Courier-Bold", fontSize: 10, color: "#0E2A47" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    padding: 10,
    borderWidth: 1.5,
    borderColor: "#0E2A47",
    backgroundColor: "#F4F8FA",
  },
  grandLabel: { fontFamily: "Helvetica-Bold", fontSize: 13, color: "#0E2A47" },
  grandValue: { fontFamily: "Courier-Bold", fontSize: 13, color: "#1F8A5A" },
  notes: {
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: "#E2E5EA",
    fontSize: 9,
    color: "#5B6472",
    lineHeight: 1.5,
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

export type PayslipPDFProps = {
  employee: {
    name: string;
    position?: string | null;
    department?: string | null;
    idNumber?: string | null;
  };
  periodStart: string;
  periodEnd: string;
  payDate: string;
  runId: number;
  salary: string;
  additions: string;
  tax: string;
  uif: string;
  otherDeductions: string;
  net: number;
  status: string;
  notes?: string | null;
  company: {
    companyName: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    logoData?: string | null;
    registrationNumber?: string | null;
    vatNumber?: string | null;
    currency?: string;
    invoiceFooter?: string | null;
  };
};

export default function PayslipPDF({
  employee,
  periodStart,
  periodEnd,
  payDate,
  runId,
  salary,
  additions,
  tax,
  uif,
  otherDeductions,
  net,
  status,
  notes,
  company,
}: PayslipPDFProps) {
  const money = (v: string | number | null | undefined) => formatMoney(v, company.currency || "R");
  const gross = toNumber(salary) + toNumber(additions);
  const totalDeductions = toNumber(tax) + toNumber(uif) + toNumber(otherDeductions);

  return (
    <Document title={`Pay slip #${runId} · ${employee.name}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>Employee pay slip</Text>
            <Text style={styles.docTitle}>PAYSLIP</Text>
            <Text style={styles.docSub}>Payroll run #{runId}</Text>
            <Text style={styles.stamp}>{status === "paid" ? "Paid" : "Draft"}</Text>
          </View>
          <View style={styles.companyBlock}>
            {company.logoData ? <View style={styles.logoWrap}><Image style={styles.logo} src={company.logoData} /></View> : null}
            <Text style={styles.companyName}>{company.companyName}</Text>
            {company.registrationNumber ? (
              <Text style={styles.small}>Reg: {company.registrationNumber}</Text>
            ) : null}
            {company.vatNumber ? <Text style={styles.small}>VAT: {company.vatNumber}</Text> : null}
            {company.address ? <Text style={styles.small}>{company.address}</Text> : null}
            {company.email ? <Text style={styles.small}>{company.email}</Text> : null}
            {company.phone ? <Text style={styles.small}>{company.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Employee</Text>
            <Text style={styles.metaValue}>{employee.name}</Text>
            {employee.position ? <Text style={styles.metaValue}>{employee.position}</Text> : null}
            {employee.department ? <Text style={styles.metaValue}>{employee.department}</Text> : null}
            {employee.idNumber ? <Text style={styles.metaValue}>{employee.idNumber}</Text> : null}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Period</Text>
            <Text style={styles.metaValue}>
              {formatDate(periodStart)} → {formatDate(periodEnd)}
            </Text>
            <Text style={[styles.metaLabel, { marginTop: 8 }]}>Pay date</Text>
            <Text style={styles.metaValue}>{formatDate(payDate)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Earnings</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Basic salary</Text>
            <Text style={styles.tableValue}>{money(salary)}</Text>
          </View>
          {toNumber(additions) > 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Additions</Text>
              <Text style={styles.tableValue}>{money(additions)}</Text>
            </View>
          ) : null}
          <View style={[styles.grossRow, { marginTop: 8 }]}>
            <Text style={styles.grossLabel}>Gross pay</Text>
            <Text style={styles.grossValue}>{money(gross)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Deductions</Text>
        <View style={styles.table}>
          {toNumber(tax) > 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>PAYE (tax)</Text>
              <Text style={styles.tableValue}>-{money(tax)}</Text>
            </View>
          ) : null}
          {toNumber(uif) > 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>UIF</Text>
              <Text style={styles.tableValue}>-{money(uif)}</Text>
            </View>
          ) : null}
          {toNumber(otherDeductions) > 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Other deductions</Text>
              <Text style={styles.tableValue}>-{money(otherDeductions)}</Text>
            </View>
          ) : null}
          {totalDeductions === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>No deductions</Text>
              <Text style={styles.tableValue}>{money(0)}</Text>
            </View>
          ) : null}
          <View style={[styles.grossRow, { marginTop: 8 }]}>
            <Text style={styles.grossLabel}>Total deductions</Text>
            <Text style={styles.grossValue}>-{money(totalDeductions)}</Text>
          </View>
        </View>

        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>NET PAY</Text>
          <Text style={styles.grandValue}>{money(net)}</Text>
        </View>

        {notes ? (
          <View style={styles.notes}>
            <Text>{notes}</Text>
          </View>
        ) : null}

        {company.invoiceFooter ? (
          <View style={styles.notes}>
            <Text>{company.invoiceFooter}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          {company.companyName} · Pay slip · Run #{runId}
        </Text>
      </Page>
    </Document>
  );
}