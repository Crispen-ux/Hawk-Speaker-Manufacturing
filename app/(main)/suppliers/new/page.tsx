import { createSupplier } from "@/lib/actions/suppliers";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export default function NewSupplierPage() {
  return (
    <div>
      <PageHeader eyebrow="Vendor directory" title="New supplier" />
      <Card className="max-w-xl">
        <form action={createSupplier} className="space-y-4">
          <Field label="Name">
            <input name="name" required className={inputClass} placeholder="Acme Hardware Distributors" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" className={inputClass} placeholder="orders@acme.com" />
          </Field>
          <Field label="Phone">
            <input name="phone" className={inputClass} placeholder="+27 82 000 0000" />
          </Field>
          <Field label="Address">
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
            <PrimaryButton type="submit">Save supplier</PrimaryButton>
            <GhostLink href="/suppliers">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
