import { getSettings } from "@/lib/numbering";
import { updateSettings } from "@/lib/actions/settings";
import { updateModules } from "@/lib/actions/modules";
import { getEnabledModules } from "@/lib/enabled-modules";
import { MODULES } from "@/lib/modules";
import { PageHeader, Field, inputClass, PrimaryButton, Card } from "@/components/ui";
import LogoUploader from "@/components/LogoUploader";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  const enabled = await getEnabledModules();

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
