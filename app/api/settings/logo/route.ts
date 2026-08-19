import { NextResponse } from "next/server";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const dataUrl = settings.logoData;

  if (!dataUrl || !dataUrl.startsWith("data:")) {
    return NextResponse.json({ error: "No logo configured" }, { status: 404 });
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid logo data" }, { status: 500 });
  }

  const [, mimeType, base64] = match;
  const bytes = Buffer.from(base64, "base64");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
