import { NextResponse } from "next/server";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    logoData: settings.logoData ?? null,
    companyName: settings.companyName,
  });
}
