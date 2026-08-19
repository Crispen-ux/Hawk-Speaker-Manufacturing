import Sidebar from "@/components/Sidebar";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar logoData={settings.logoData} companyName={settings.companyName} />
      <main className="min-w-0 flex-1 bg-paper">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
