import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { sendStatementByEmail } from "@/lib/send";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await isAuthed()) && process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { clientId, to, from, toDate, message } = await req.json();

  if (!clientId || !to) {
    return NextResponse.json({ error: "Missing client or recipient email." }, { status: 400 });
  }

  try {
    await sendStatementByEmail(Number(clientId), String(to), String(from), String(toDate), message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Something went wrong." },
      { status: 500 }
    );
  }
}
