import type { DocPDFProps } from "@/components/pdf/DocPDF";

type SettingsRow = {
  companyName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  bankDetails: string | null;
  logoData: string | null;
  registrationNumber: string | null;
  vatNumber: string | null;
  currency: string;
  paymentTerms: string | null;
  invoiceFooter: string | null;
};

/**
 * Central place that maps a settings row to the company block used by PDF
 * documents and emails. Keeping it here means new business fields only need
 * to be added once instead of in every PDF route and send function.
 */
export function companyFromSettings(settings: SettingsRow): DocPDFProps["company"] {
  return {
    companyName: settings.companyName,
    email: settings.email,
    phone: settings.phone,
    address: settings.address,
    bankDetails: settings.bankDetails,
    logoData: settings.logoData,
    registrationNumber: settings.registrationNumber,
    vatNumber: settings.vatNumber,
    currency: settings.currency,
    paymentTerms: settings.paymentTerms,
    invoiceFooter: settings.invoiceFooter,
  };
}