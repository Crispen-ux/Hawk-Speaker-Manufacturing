import Sidebar from "@/components/Sidebar";
import ModuleGate from "@/components/ModuleGate";
import { getEnabledModules } from "@/lib/enabled-modules";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const enabled = await getEnabledModules();
  const disabledKeys = Object.entries(enabled)
    .filter(([, on]) => !on)
    .map(([key]) => key);
  return (
    <div className="flex min-h-dvh">
      <Sidebar
        logoData={settings.logoDarkData}
        companyName={settings.companyName}
        disabledKeys={disabledKeys}
      />
      <main className="min-w-0 flex-1 bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
          <ModuleGate disabledKeys={disabledKeys}>{children}</ModuleGate>
        </div>
      </main>
    </div>
  );
}
