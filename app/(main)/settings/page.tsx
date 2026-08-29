import { getSettings } from "@/lib/numbering";
import { updateSettings } from "@/lib/actions/settings";
import { updateModules } from "@/lib/actions/modules";
import { getEnabledModules } from "@/lib/enabled-modules";
import { MODULES } from "@/lib/modules";
import { getEmailTemplates, EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates";
import { DEFAULT_WHATSAPP_TEMPLATES, WHATSAPP_TEMPLATE_KEYS } from "@/lib/communications/templates";
import { PageHeader, Field, inputClass, PrimaryButton, Card } from "@/components/ui";
import LogoUploader from "@/components/LogoUploader";

export const dynamic = "force-dynamic";

const DEFAULT_WHATSAPP = JSON.stringify(DEFAULT_WHATSAPP_TEMPLATES, null, 2);

const DOC_FIELDS: { label: string; prefix: string; next: string }[] = [
  { label: "Invoices", prefix: "invoicePrefix", next: "nextInvoiceNumber" },
  { label: "Quotations", prefix: "quotationPrefix", next: "nextQuotationNumber" },
  { label: "Purchase orders", prefix: "purchaseOrderPrefix", next: "nextPurchaseOrderNumber" },
  { label: "Job cards", prefix: "jobCardPrefix", next: "nextJobCardNumber" },
  { label: "Delivery notes", prefix: "deliveryNotePrefix", next: "nextDeliveryNoteNumber" },
];

const EMAIL_SECTION_HINT: Record<string, string> = {
  invoice: "Invoices",
  quotation: "Quotations",
  statement: "Statements",
  purchaseOrder: "Purchase orders",
  jobCard: "Job cards",
  deliveryNote: "Delivery notes",
};

export default async function SettingsPage() {
  const settings = await getSettings();
  const enabled = await getEnabledModules();
  const templates = getEmailTemplates(settings);
  const whatsapp = settings.whatsappTemplates ?? DEFAULT_WHATSAPP;

  return (
    <div>
      <PageHeader eyebrow="Configuration" title="Settings" />
      <form action={updateSettings} className="space-y-8">
        <Card className="max-w-2xl">
          <h2 className="mb-4 font-display text-lg font-bold text-navy">Branding</h2>
          <div className="grid grid-cols-2 gap-6">
            <Field label="Logo — light backgrounds (PDFs, documents)">
              <LogoUploader initialLogo={settings.logoData} fieldName="logoData" removeFieldName="removeLogo" previewBg="light" />
            </Field>
            <Field label="Logo — dark backgrounds (sidebar, login screen)">
              <LogoUploader
                initialLogo={settings.logoDarkData}
                fieldName="logoDarkData"
                removeFieldName="removeLogoDark"
                previewBg="dark"
              />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-ink-soft">
            Use your regular (navy/full-colour) logo for the light-background slot, and a white or reversed
            version for the dark-background slot — otherwise a white logo will disappear on white PDF pages,
            or a dark logo will disappear on the navy sidebar. If you only upload one, it's used everywhere and
            may not show up well on one of the two.
          </p>
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-4 font-display text-lg font-bold text-navy">Company</h2>
          <div className="space-y-5">
            <Field label="Company name">
              <input name="companyName" defaultValue={settings.companyName} required className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Registration number">
                <input
                  name="registrationNumber"
                  defaultValue={settings.registrationNumber ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="VAT number">
                <input name="vatNumber" defaultValue={settings.vatNumber ?? ""} className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <input name="email" defaultValue={settings.email ?? ""} className={inputClass} />
              </Field>
              <Field label="Phone">
                <input name="phone" defaultValue={settings.phone ?? ""} className={inputClass} />
              </Field>
            </div>
            <Field label="Business address">
              <textarea name="address" defaultValue={settings.address ?? ""} rows={3} className={inputClass} />
            </Field>
          </div>
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-4 font-display text-lg font-bold text-navy">Money &amp; payments</h2>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Currency symbol (shown on documents)">
                <input name="currency" defaultValue={settings.currency} className={inputClass} />
              </Field>
              <Field label="Default tax rate %">
                <input name="defaultTaxRate" defaultValue={settings.defaultTaxRate} className={inputClass} />
              </Field>
            </div>
            <label className="flex items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                name="taxIncluded"
                defaultChecked={settings.taxIncluded}
                className="h-4 w-4 accent-navy"
              />
              Prices include tax (VAT-inclusive)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Default payment terms (days)">
                <input
                  type="number"
                  name="paymentTermsDays"
                  defaultValue={settings.paymentTermsDays}
                  min={0}
                  className={inputClass}
                />
              </Field>
              <Field label="Payment terms text">
                <input name="paymentTerms" defaultValue={settings.paymentTerms ?? ""} className={inputClass} />
              </Field>
            </div>
            <Field label="Banking details (shown on payment documents)">
              <textarea name="bankDetails" defaultValue={settings.bankDetails ?? ""} rows={3} className={inputClass} />
            </Field>
          </div>
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-4 font-display text-lg font-bold text-navy">Document numbering</h2>
          <p className="-mt-2 mb-4 text-xs text-ink-soft">
            Serial numbers are assigned automatically. The next number is what the next document will be given.
          </p>
          <div className="space-y-3">
            {DOC_FIELDS.map((d) => (
              <div key={d.prefix} className="flex items-end gap-4">
                <Field label={d.label} extraClass="flex-1">
                  <input name={d.prefix} defaultValue={String(settings[d.prefix as keyof typeof settings] ?? "")} className={inputClass} />
                </Field>
                <Field label="Next number" extraClass="w-40">
                  <input
                    type="number"
                    name={d.next}
                    defaultValue={String(settings[d.next as keyof typeof settings] ?? "")}
                    min={1}
                    className={inputClass}
                  />
                </Field>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Field label="Invoice footer (shown at the end of invoice PDFs)">
              <textarea name="invoiceFooter" defaultValue={settings.invoiceFooter ?? ""} rows={2} className={inputClass} />
            </Field>
          </div>
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-1 font-display text-lg font-bold text-navy">Email templates</h2>
          <p className="mb-5 text-xs text-ink-soft">
            Subject and greeting used when sending each document type by email. Use{" "}
            <code className="rounded bg-paper-dim px-1 font-mono text-[11px]">{"{placeholders}"}</code> like{" "}
            <code className="rounded bg-paper-dim px-1 font-mono text-[11px]">{"{number}"}</code> — they're filled
            in per document.
          </p>
          <div className="space-y-6">
            {Object.entries(templates).map(([kind, tpl]) => (
              <fieldset key={kind} className="rounded-md border border-rule p-4">
                <legend className="px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                  {EMAIL_SECTION_HINT[kind] ?? kind}
                </legend>
                <div className="space-y-4">
                  <Field label="Subject">
                    <input
                      name={`emailTemplates.${kind}.subject`}
                      defaultValue={tpl.subject}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Greeting">
                    <textarea
                      name={`emailTemplates.${kind}.greeting`}
                      defaultValue={tpl.greeting}
                      rows={2}
                      className={inputClass}
                    />
                  </Field>
                  <p className="text-xs text-ink-soft">
                    Available:{" "}
                    {(EMAIL_TEMPLATE_KEYS as Record<string, readonly string[]>)[kind]?.map((k) => (
                      <code key={k} className="mr-1 rounded bg-paper-dim px-1 font-mono text-[11px]">
                        {"{"}
                        {k}
                        {"}"}
                      </code>
                    ))}
                  </p>
                </div>
              </fieldset>
            ))}
          </div>
        </Card>

        <Card className="max-w-2xl">
          <h2 className="mb-1 font-display text-lg font-bold text-navy">WhatsApp templates</h2>
          <p className="mb-5 text-xs text-ink-soft">
            Message bodies for WhatsApp sends (invoices, quotations, statements, payment reminders, delivery
            notifications and document links). JSON keyed by message type.
          </p>
          <Field label="Templates (JSON)">
            <textarea name="whatsappTemplates" defaultValue={whatsapp} rows={10} className={inputClass} />
          </Field>
          <div className="mt-3 space-y-1">
            {Object.entries(WHATSAPP_TEMPLATE_KEYS).map(([kind, keys]) => (
              <p key={kind} className="text-xs text-ink-soft">
                <span className="font-mono lowercase">{kind}:</span>{" "}
                {keys.map((k) => (
                  <code key={k} className="mr-1 rounded bg-paper-dim px-1 font-mono text-[11px]">
                    {"{"}
                    {k}
                    {"}"}
                  </code>
                ))}
              </p>
            ))}
          </div>
        </Card>

        <div className="max-w-2xl pt-2">
          <PrimaryButton type="submit">Save settings</PrimaryButton>
        </div>
      </form>

      <Card className="mt-8 max-w-2xl">
        <h2 className="mb-1 font-display text-lg font-bold text-navy">Modules</h2>
        <p className="mb-5 text-xs text-ink-soft">
          Turn areas of the system on or off. Disabled modules disappear from the sidebar and their pages
          are blocked — nothing else is affected. Dashboard and Settings are always available.
        </p>
        <form action={updateModules}>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODULES.filter((m) => !m.alwaysOn).map((m) => (
              <label
                key={m.key}
                className={`flex items-start gap-3 rounded-md border border-rule px-3 py-2.5 ${
                  m.built ? "cursor-pointer hover:border-forest/40 hover:bg-paper-dim/50" : "opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  name={m.key}
                  defaultChecked={enabled[m.key]}
                  disabled={!m.built}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
                />
                <span className="min-w-0">
                  <span className="text-sm font-medium text-ink">
                    {m.label}
                    {!m.built && (
                      <span className="ml-2 rounded bg-paper-dim px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-soft">
                        Upcoming
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-ink-soft">{m.description}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="pt-5">
            <PrimaryButton type="submit">Save modules</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}