import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/ToastProvider";
import ModuleGate from "@/components/ModuleGate";
import { getEnabledModules } from "@/lib/enabled-modules";
import { getSettings } from "@/lib/numbering";
import { sessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const enabled = await getEnabledModules();
  const user = await sessionUser();
  const disabledKeys = Object.entries(enabled)
    .filter(([, on]) => !on)
    .map(([key]) => key);
  return (
    <div className="flex min-h-dvh">
      <Sidebar
        logoData={settings.logoDarkData}
        companyName={settings.companyName}
        disabledKeys={disabledKeys}
        role={user?.role}
      />
      <main className="min-w-0 flex-1 bg-paper">
        <div className="mx-auto max-w-6xl px-4 pb-28 pt-8 md:px-8 md:pb-10 md:pt-10">
          <ModuleGate disabledKeys={disabledKeys}>
            <ToastProvider>{children}</ToastProvider>
          </ModuleGate>
        </div>
      </main>
    </div>
  );
}
