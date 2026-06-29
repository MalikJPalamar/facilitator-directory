import { redirect } from "next/navigation";

/**
 * API-key management moved into the unified Developers / Connect hub. This route
 * is kept as a permanent redirect so existing links (e.g. the admin dashboard's
 * "API keys" button and the OAuth discovery doc's token_issuance pointer) land
 * on the new home for keys.
 */
export default function KeysPage() {
  redirect("/admin/developers#keys");
}
