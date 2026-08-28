"use client";

import { usePathname } from "next/navigation";
import { getModuleForPath } from "@/lib/modules";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export default function ModuleGate({
  children,
  disabledKeys,
}: {
  children: React.ReactNode;
  disabledKeys: string[];
}) {
  const pathname = usePathname();
  const mod = getModuleForPath(pathname);
  const isDisabled = mod && !mod.alwaysOn && disabledKeys.includes(mod.key);

  if (isDisabled) {
    return (
      <div>
        <PageHeader eyebrow="Module disabled" title={mod.label} />
        <Card className="max-w-xl">
          <p className="text-sm text-ink-soft">
            This area is switched off. You can re-enable it on the Settings page under Modules.
          </p>
          <div className="pt-4">
            <LinkButton href="/settings">Open Settings</LinkButton>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}