import { createClient } from "@/lib/actions/clients";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export default function NewClientPage() {
  return (
    <div>
      <PageHeader eyebrow="Address book" title="New client" />
      <Card className="max-w-xl">
        <form action={createClient} className="space-y-4">
          <Field label="Name">
            <input name="name" required className={inputClass} placeholder="Acme Studios" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" className={inputClass} placeholder="billing@acme.com" />
          </Field>
          <Field label="Phone">
            <input name="phone" className={inputClass} placeholder="+27 82 000 0000" />
          </Field>
          <Field label="Billing address">
            <textarea name="address" rows={3} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company registration">
              <input name="registrationNumber" className={inputClass} placeholder="e.g. 2020/123456/07" />
            </Field>
            <Field label="VAT number">
              <input name="vatNumber" className={inputClass} placeholder="e.g. 4112345678" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={2} className={inputClass} />
          </Field>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save client</PrimaryButton>
            <GhostLink href="/clients">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
