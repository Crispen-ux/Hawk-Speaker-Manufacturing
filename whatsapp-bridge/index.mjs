/**
 * WhatsApp Bridge — sends WhatsApp messages from YOUR real business number
 * with no third-party provider (Twilio/Meta etc.).
 *
 * HOW IT WORKS
 *   This process uses the Baileys library, which speaks the same protocol as
 *   WhatsApp Web. It registers your number as an extra "device" — exactly like
 *   WhatsApp Web does — and can then send text + PDF documents as if they came
 *   from your phone. The app's WhatsApp driver (lib/communications/channels/
 *   baileys-bridge.ts) calls this bridge over HTTP.
 *
 * FIRST RUN
 *   1. npm install
 *   2. node index.mjs
 *   3. Scan the QR code with WhatsApp on the business number
 *      (Menu -> Linked devices -> Link a device). The pairing is saved to
 *      ./data/ so you only scan once.
 *
 * KEEPING IT ALIVE
 *   The phone used to pair (plus this computer) must stay online-ish; the
 *   session is persisted and reconnects automatically. For 24/7 use, keep it
 *   running on an always-on machine (office PC, NAS, cheap VPS):
 *     - Windows: pm2 or NSSM ("node index.mjs" as a service)
 *     - Linux:   pm2   (pm2 start index.mjs --name whatsapp-bridge)
 *
 * ENV (all optional except BRIDGE_TOKEN-only-if-you-want-security)
 *   BRIDGE_PORT   default 3789
 *   BRIDGE_TOKEN  shared secret; if set, the app must send it as a Bearer token.
 *
 * ENDPOINTS
 *   GET  /status   -> { ok, loggedIn, phone, qr: <string|null>, error }
 *   POST /send     -> { to: "<27...>", body, link? } -> { ok }
 *   POST /logout   -> delete pairing (you'll rescan)
 */
import { createServer } from "node:http";
import makeWASocket, {
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";

const PORT = Number(process.env.BRIDGE_PORT ?? 3789);
const TOKEN = process.env.BRIDGE_TOKEN ?? "";
const DATA_DIR = process.env.BRIDGE_DATA_DIR ?? "data";

const state = {
  sock: null,
  qr: null,
  lastError: null,
};

const silentLogger = pino({ level: "silent" });

function now() {
  return new Date().toISOString();
}

function log(...args) {
  console.log(`[${now()}]`, ...args);
}

/** QR to console + keep the string for GET /status. */
function printQr(qr) {
  state.qr = qr;
  log("Scan the QR below with WhatsApp -> Linked devices -> Link a device:");
  qrcode.generate(qr, { small: true }, (out) => console.log(out));
  log("(Raw QR also available at GET /status if the block doesn't render.)");
}

function normalizeJid(input) {
  if (typeof input !== "string") return null;
  if (input.includes("@")) return input;
  let d = input.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "27" + d.slice(1);
  else if (d.length === 9) d = "27" + d;
  if (!/^\d{9,15}$/.test(d)) return null;
  return `${d}@s.whatsapp.net`;
}

function fileNameFor(link, mime) {
  let name = "";
  try {
    name = decodeURIComponent(new URL(link).pathname.split("/").filter(Boolean).pop() || "");
  } catch {
    name = "";
  }
  if (!name.includes(".")) {
    if (mime === "application/pdf") name += ".pdf";
    else if (mime?.startsWith("image/")) name += ".jpg";
    else name += ".pdf";
  }
  return name.slice(0, 120);
}

/** Send a message. Sends the PDF as a WhatsApp document when possible. */
async function sendMessage(to, body, link) {
  const sock = state.sock;
  if (!sock?.user) throw new Error("Not connected to WhatsApp — scan the QR first (GET /status).");
  const jid = normalizeJid(to);
  if (!jid) throw new Error(`Cannot interpret number "${to}" (expect digits, e.g. 27615484573).`);

  let sentDocument = false;
  if (link) {
    try {
      const res = await fetch(link, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        const mime = res.headers.get("content-type") || "";
        const buf = Buffer.from(await res.arrayBuffer());
        if (!mime.includes("text/html") && buf.length > 0 && buf.length <= 16 * 1024 * 1024) {
          await sock.sendMessage(jid, {
            document: { buffer: buf, fileName: fileNameFor(link, mime), mimetype: mime },
            caption: body,
          });
          sentDocument = true;
          log("sent", jid, "as document", fileNameFor(link, mime));
        }
      }
    } catch {
      /* fall through to plain text with the link */
    }
  }

  if (!sentDocument) {
    const text = link && !body.includes(link) ? `${body}\n${link}` : body;
    await sock.sendMessage(jid, { text });
    log("sent", jid, "as text");
  }
  return { ok: true, mode: sentDocument ? "document" : "text" };
}

async function startSocket() {
  const { version } = await fetchLatestBaileysVersion();
  const { state: auth, saveCreds } = await useMultiFileAuthState(DATA_DIR);
  const sock = makeWASocket({ version, auth, logger: silentLogger, printQRInTerminal: false });
  state.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) printQr(qr);
    if (connection === "open") {
      state.qr = null;
      state.lastError = null;
      log("Connected as", sock.user?.id);
    }
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      state.sock = null;
      if (loggedOut) {
        state.lastError = "Logged out — delete ./data and rescan the QR.";
        log(state.lastError);
      } else {
        state.lastError = `Disconnected (${statusCode ?? "?"}); reconnecting…`;
        log(state.lastError);
        setTimeout(startSocket, 3_000);
      }
    }
  });

  sock.ev.on("messages.upsert", ({ type }) => {
    if (type === "notify") state.lastError = null; // activity → session healthy
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

function authorized(req) {
  if (!TOKEN) return true;
  const header = req.headers.authorization || "";
  return header === `Bearer ${TOKEN}`;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = createServer(async (req, res) => {
  if (!authorized(req)) return sendJson(res, 401, { ok: false, error: "Unauthorized." });

  const url = (req.url || "/").split("?")[0];
  try {
    if (req.method === "GET" && url === "/status") {
      return sendJson(res, 200, {
        ok: true,
        loggedIn: Boolean(state.sock?.user),
        phone: state.sock?.user?.id ?? null,
        qr: state.qr,
        error: state.lastError,
      });
    }

    if (req.method === "POST" && url === "/send") {
      const { to, body, link } = await readBody(req);
      if (!to) return sendJson(res, 400, { ok: false, error: "Missing 'to'." });
      if (!body) return sendJson(res, 400, { ok: false, error: "Missing 'body'." });
      const result = await sendMessage(to, body, link);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url === "/logout") {
      await state.sock?.logout().catch(() => {});
      state.sock = null;
      state.qr = null;
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { ok: false, error: "Not found." });
  } catch (e) {
    return sendJson(res, 502, { ok: false, error: e instanceof Error ? e.message : "Bridge error." });
  }
});

server.listen(PORT, () => {
  log(`WhatsApp bridge listening on http://localhost:${PORT}${TOKEN ? " (token auth)" : ""}`);
  log("Pair it once: scan the QR, then the app can send from this number.");
  log("Careful: this is the unofficial WhatsApp Web protocol — keep messages to business volume.");
  startSocket().catch((e) => log("Failed to start socket:", e?.message ?? e));
});

process.on("unhandledRejection", (e) => {
  log("unhandledRejection:", e?.message ?? e);
});