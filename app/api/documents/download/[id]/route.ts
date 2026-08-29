import { NextRequest } from "next/server";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, Number((await params).id)));
  if (!row) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });

  const contentDisposition = /^image\/(png|jpe?g|gif|webp)$|^application\/pdf$/.test(row.mimeType ?? "")
    ? "inline"
    : "attachment";

  return new Response(Buffer.from(row.data, "base64"), {
    headers: {
      "Content-Type": row.mimeType || "application/octet-stream",
      "Content-Disposition": `${contentDisposition}; filename="${row.fileName}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}