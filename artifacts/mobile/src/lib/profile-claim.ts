import { api } from "./api";

interface ProfileClaimRequest {
  (path: string, options: { method: "POST" }): Promise<unknown>;
}

export async function finalizeProfileClaim(
  request: ProfileClaimRequest = api,
): Promise<void> {
  await request("/profile/claim", { method: "POST" });
}
