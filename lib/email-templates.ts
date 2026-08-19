function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type DetailRow = { label: string; value: string };

export type EmailCompany = {
  name: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  bankDetails?: string | null;
  logoUrl?: string | null;
};

/**
 * Builds a bulletproof HTML email: table-based layout, inline styles, web
 * -safe fonts. Outlook (desktop) uses Word's rendering engine and ignores
 * most modern CSS, strips <style> in some contexts, and blocks data: URI
 * images entirely — so this avoids all of that rather than relying on it.
 */
export function buildDocumentEmail({
  kicker,
  heading,
  greeting,
  message,
  recipientName,
  detailRows,
  highlight,
  attachmentLabel,
  company,
}: {
  kicker: string;
  heading: string;
  greeting: string;
  message?: string;
  recipientName?: string | null;
  detailRows: DetailRow[];
  highlight: DetailRow;
  attachmentLabel: string;
  company: EmailCompany;
}) {
  const bodyText = message ? escapeHtml(message.trim()).replace(/\n/g, "<br/>") : escapeHtml(greeting);
  const salutation = recipientName ? `Good day ${escapeHtml(recipientName)},` : "Good day,";

  const detailRowsHtml = detailRows
    .map(
      (r) => `
        <tr>
          <td style="padding:6px 0; font-family:Arial,Helvetica,sans-serif; font-size:13px; color:#5B6472;">${escapeHtml(r.label)}</td>
          <td style="padding:6px 0; font-family:'Courier New',Courier,monospace; font-size:13px; color:#16212E; text-align:right;">${escapeHtml(r.value)}</td>
        </tr>`
    )
    .join("");

  const logoBlock = company.logoUrl
    ? `<img src="${company.logoUrl}" alt="${escapeHtml(company.name)}" height="34" style="display:block; height:34px; width:auto; border:0;" />`
    : `<span style="font-family:Arial,Helvetica,sans-serif; font-size:20px; font-weight:bold; color:#0E2A47;">${escapeHtml(company.name)}</span>`;

  const bankBlock = company.bankDetails
    ? `<tr><td style="padding-top:16px; font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#5B6472; line-height:1.6;">
        <strong style="color:#16212E;">Payment details</strong><br/>${escapeHtml(company.bankDetails).replace(/\n/g, "<br/>")}
      </td></tr>`
    : "";

  const contactLine = [company.email, company.phone].filter(Boolean).join("  ·  ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0; padding:0; background-color:#F7F8FA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FA;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%; background-color:#FFFFFF; border:1px solid #E2E5EA; border-radius:8px; overflow:hidden;">

          <!-- Accent bar -->
          <tr>
            <td style="background-color:#12B8C4; height:4px; line-height:4px; font-size:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;">
              ${logoBlock}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 40px;">
              <p style="margin:0 0 4px; font-family:Arial,Helvetica,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5B6472;">${escapeHtml(kicker)}</p>
              <h1 style="margin:0 0 20px; font-family:Arial,Helvetica,sans-serif; font-size:20px; color:#0E2A47;">${escapeHtml(heading)}</h1>
              <p style="margin:0 0 16px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:1.6; color:#16212E;">${salutation}</p>
              <p style="margin:0 0 20px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:1.6; color:#16212E;">${bodyText}</p>
              <p style="margin:0 0 24px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:1.6; color:#16212E;">Thank you,<br/>${escapeHtml(company.name)}</p>
            </td>
          </tr>

          <!-- Details card -->
          <tr>
            <td style="padding:0 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FA; border-radius:6px;">
                <tr>
                  <td style="padding:20px 20px 12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${detailRowsHtml}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px 20px; border-top:1px solid #E2E5EA; padding-top:12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family:Arial,Helvetica,sans-serif; font-size:13px; font-weight:bold; color:#0E2A47;">${escapeHtml(highlight.label)}</td>
                        <td style="font-family:'Courier New',Courier,monospace; font-size:17px; font-weight:bold; color:#0E2A47; text-align:right;">${escapeHtml(highlight.value)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Attachment note -->
          <tr>
            <td style="padding:16px 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif; font-size:13px; color:#5B6472;">
                    📎 <span style="color:#16212E;">${escapeHtml(attachmentLabel)}</span> attached
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E2E5EA;">
                <tr>
                  <td style="padding-top:20px; font-family:Arial,Helvetica,sans-serif; font-size:13px; font-weight:bold; color:#0E2A47;">
                    ${escapeHtml(company.name)}
                  </td>
                </tr>
                ${
                  company.address
                    ? `<tr><td style="padding-top:2px; font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#5B6472; line-height:1.5;">${escapeHtml(company.address).replace(/\n/g, "<br/>")}</td></tr>`
                    : ""
                }
                ${
                  contactLine
                    ? `<tr><td style="padding-top:2px; font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#5B6472;">${escapeHtml(contactLine)}</td></tr>`
                    : ""
                }
                ${bankBlock}
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
