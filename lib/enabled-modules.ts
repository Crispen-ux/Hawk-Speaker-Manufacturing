import { db } from "@/db";
import { modules } from "@/db/schema";
import { MODULES } from "@/lib/modules";

/** Per-module enabled flags. Modules without a saved row fall back to their default. */
export async function getEnabledModules(): Promise<Record<string, boolean>> {
  const rows = await db.select().from(modules);
  const map: Record<string, boolean> = {};
  for (const m of MODULES) map[m.key] = m.enabledByDefault ?? true;
  for (const r of rows) map[r.key] = r.enabled;
  return map;
}

/** Keys of modules the user has turned off. */
export async function getDisabledModuleKeys(): Promise<string[]> {
  const enabled = await getEnabledModules();
  return Object.entries(enabled)
    .filter(([, on]) => !on)
    .map(([key]) => key);
}