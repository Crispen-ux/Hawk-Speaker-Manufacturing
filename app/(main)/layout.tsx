import Sidebar from "@/components/Sidebar";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="flex min-h-dvh">
      <Sidebar logoData={settings.logoDarkData} companyName={settings.companyName} />
      <main className="min-w-0 flex-1 bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">{children}</div>
      </main>
    </div>
  );
}
