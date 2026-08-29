"use server";

import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";

export async function createClient(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const [row] = await db
    .insert(clients)
    .values({
      name,
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .returning({ id: clients.id });

  revalidatePath("/clients");
  redirect(flashUrl(`/clients/${row.id}` , "Client created"));
}

export async function updateClient(id: number, formData: FormData) {
  await db
    .update(clients)
    .set({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .where(eq(clients.id, id));

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

export async function deleteClient(id: number) {
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/clients");
  redirect(flashUrl(`/clients` , "Client deleted"));
}
