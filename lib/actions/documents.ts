"use server";

import { db } from "@/db";
import { uploads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

type Visibility = (typeof uploads.$inferInsert)["visibility"];

function toVisibility(value: string): Visibility {
  if (value === "client" || value === "both") return value;
  return "internal";
}

export async function uploadDocument(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const file = formData.get("file");
  const category = String(formData.get("category") ?? "") || null;
  const clientId = (() => {
    const v = formData.get("clientId");
    return v ? Number(v) : null;
  })();
  const visibility = toVisibility(String(formData.get("visibility") ?? "internal"));
  if (!(file instanceof File)) throw new Error("Choose a file to upload");
  if (!label) throw new Error("Label is required");
  if (file.size === 0) throw new Error("File is empty");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 4 MB — keep depot uploads small");

  const buffer = Buffer.from(await file.arrayBuffer());

  await db.insert(uploads).values({
    label,
    fileName: file.name,
    mimeType: file.type || null,
    size: file.size,
    data: buffer.toString("base64"),
    category,
    clientId,
    visibility,
  });

  revalidatePath("/documents");
}

export async function updateUpload(id: number, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const category = String(formData.get("category") ?? "") || null;
  const clientId = (() => {
    const v = formData.get("clientId");
    return v ? Number(v) : null;
  })();
  const visibility = toVisibility(String(formData.get("visibility") ?? "internal"));
  if (!label) throw new Error("Label is required");

  await db
    .update(uploads)
    .set({ label, category, clientId, visibility })
    .where(eq(uploads.id, id));

  revalidatePath("/documents");
}

export async function deleteUpload(id: number) {
  await db.delete(uploads).where(eq(uploads.id, id));
  revalidatePath("/documents");
  redirect(flashUrl(`/documents`, "Upload deleted"));
}
