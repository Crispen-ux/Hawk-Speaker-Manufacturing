"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveDocumentLink } from "@/lib/public-links";
import { approveQuotation, declineQuotation } from "@/lib/services/quotations";
import { flashUrl } from "@/lib/flash";

/**
 * Server actions for the public, token-based approval page (/approve/[token]).
 *
 * The unguessable share token serves as the authentication: anyone holding the
 * link can approve/decline that specific quotation, exactly like they can
 * already open its PDF via the shared link. No portal login is required.
 */

/**
 * Resolves the token and returns the authority for the transaction: the
 * quotation id is taken from the token itself, never from the form, so a
 * tampered form can't target a different quotation than the link grants.
 */
async function authorityFromForm(formData: FormData): Promise<{ token: string; quotationId: number } | null> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return null;
  const meta = await resolveDocumentLink(token);
  if (!meta || meta.kind !== "quotation" || !meta.documentId) return null;
  return { token, quotationId: meta.documentId };
}

export async function sharedApproveQuotation(formData: FormData) {
  const authority = await authorityFromForm(formData);
  if (!authority) {
    redirect(flashUrl("/", "This approval link is invalid or has expired.", "error"));
  }

  try {
    await approveQuotation(authority.quotationId, {
      actorId: `shared:${authority.token}`,
      comment: String(formData.get("comment") ?? "").trim(),
    });
  } catch (e) {
    redirect(flashUrl(`/approve/${authority.token}`, e instanceof Error ? e.message : "Could not approve quotation", "error"));
  }
  revalidatePath(`/approve/${authority.token}`);
  redirect(flashUrl(`/approve/${authority.token}`, "Quotation approved. Thank you.", "success"));
}

export async function sharedDeclineQuotation(formData: FormData) {
  const authority = await authorityFromForm(formData);
  if (!authority) {
    redirect(flashUrl("/", "This approval link is invalid or has expired.", "error"));
  }
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    redirect(flashUrl(`/approve/${authority.token}`, "Please provide a reason for declining.", "error"));
  }

  try {
    await declineQuotation(authority.quotationId, {
      actorId: `shared:${authority.token}`,
      reason,
    });
  } catch (e) {
    redirect(flashUrl(`/approve/${authority.token}`, e instanceof Error ? e.message : "Could not decline quotation", "error"));
  }
  revalidatePath(`/approve/${authority.token}`);
  redirect(flashUrl(`/approve/${authority.token}`, "Quotation declined.", "success"));
}
