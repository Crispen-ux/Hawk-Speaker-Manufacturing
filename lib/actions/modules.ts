"use server";

import { db } from "@/db";
import { modules } from "@/db/schema";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { MODULES } from "@/lib/modules";

export async function updateModules(formData: FormData) {
  const patches = MODULES.filter((m) => !m.alwaysOn).map((m) => ({
    key: m.key,
    enabled: formData.get(m.key) === "on",
  }));

  await db
    .insert(modules)
    .values(patches)
    .onConflictDoUpdate({
      target: modules.key,
      set: { enabled: sql`excluded.enabled` },
    });

  revalidatePath("/settings");
  revalidatePath("/");
}