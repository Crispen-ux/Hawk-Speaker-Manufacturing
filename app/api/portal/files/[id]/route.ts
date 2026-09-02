import { NextRequest } from "next/server";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireActivePortalUser } from "@/lib/auth-portal";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireActivePortalUser();
  const { id } = await params;

  const [row] = await db
    .select()
    .from(uploads)
    .where(
      and(
        eq(uploads.id, Number(id)),
        eq(uploads.clientId, session.clientId),
        inArray(uploads.visibility, ["client", "both"])
      )
    );
  if (!row) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });

  const contentDisposition = /^image\/(png|jpe?g|gif|webp)$|^application\/pdf$/.test(row.mimeType ?? "")
    ? "inline"
    : "attachment";

  return new Response(Buffer.from(row.data, "base64"), {
    headers: {
      "Content-Type": row.mimeType || "application/octet-stream",
      "Content-Disposition": `${contentDisposition}; filename="${row.fileName}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
