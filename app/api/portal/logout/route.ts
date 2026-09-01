import { NextResponse } from "next/server";
import { destroyPortalSession } from "@/lib/auth-portal";

export async function POST() {
  await destroyPortalSession();
  return NextResponse.json({ ok: true });
}
