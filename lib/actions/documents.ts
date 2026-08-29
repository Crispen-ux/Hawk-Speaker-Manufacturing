"use server";

import { db } from "@/db";
import { uploads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

export async function uploadDocument(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const file = formData.get("file");
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
  });

  revalidatePath("/documents");
}

export async function deleteUpload(id: number) {
  await db.delete(uploads).where(eq(uploads.id, id));
  revalidatePath("/documents");
  redirect(flashUrl(`/documents`, "Upload deleted"));
}