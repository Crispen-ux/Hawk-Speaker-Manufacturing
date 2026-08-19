import { getSettings } from "@/lib/numbering";
import { updateSettings } from "@/lib/actions/settings";
import { PageHeader, Field, inputClass, PrimaryButton, Card } from "@/components/ui";
import LogoUploader from "@/components/LogoUploader";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div>
      <PageHeader eyebrow="Configuration" title="Settings" />
      <Card className="max-w-2xl">
        <form action={updateSettings} className="space-y-5">
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
          <Field label="Company name">
            <input name="companyName" defaultValue={settings.companyName} required className={inputClass} />
          </Field>
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
          <Field label="Banking details (shown on invoice PDFs)">
            <textarea name="bankDetails" defaultValue={settings.bankDetails ?? ""} rows={3} className={inputClass} />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Default tax rate %">
              <input name="defaultTaxRate" defaultValue={settings.defaultTaxRate} className={inputClass} />
            </Field>
            <Field label="Invoice prefix">
              <input name="invoicePrefix" defaultValue={settings.invoicePrefix} className={inputClass} />
            </Field>
            <Field label="Quotation prefix">
              <input name="quotationPrefix" defaultValue={settings.quotationPrefix} className={inputClass} />
            </Field>
          </div>
          <div className="pt-2">
            <PrimaryButton type="submit">Save settings</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
