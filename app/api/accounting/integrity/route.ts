import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runAccountingIntegrityChecks } from "@/lib/accounting/integrity";

export async function GET() {
  try {
    await requireAdmin();
    const checks = await runAccountingIntegrityChecks();
    const ok = checks.every((check) => check.ok);
    return NextResponse.json(
      { ok, checkedAt: new Date().toISOString(), checks },
      { status: ok ? 200 : 503 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run accounting integrity checks";
    const status = message === "Not signed in" || message === "Admin access required" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
