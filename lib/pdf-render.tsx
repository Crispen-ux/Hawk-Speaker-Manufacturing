import { renderToBuffer } from "@react-pdf/renderer";
import DocPDF, { DocPDFProps } from "@/components/pdf/DocPDF";
import StatementPDF, { StatementRow } from "@/components/pdf/StatementPDF";

export async function renderDocPDFBuffer(props: DocPDFProps) {
  return renderToBuffer(<DocPDF {...props} />);
}

export async function renderStatementPDFBuffer(props: {
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
    registrationNumber?: string | null;
    vatNumber?: string | null;
    currency?: string;
  };
}) {
  return renderToBuffer(<StatementPDF {...props} />);
}
