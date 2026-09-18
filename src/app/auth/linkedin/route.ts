/**
 * LinkedIn OAuth — Step 1: Redirect to LinkedIn authorization
 *
 * Visit http://localhost:3000/auth/linkedin to start the flow.
 * Only accessible to admins.
 */

import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "LINKEDIN_CLIENT_ID is not set in .env.local" },
      { status: 500 }
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/linkedin/callback`;
  const scope = "openid profile w_member_social";
  const state = crypto.randomUUID(); // CSRF protection

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  // Redirect the browser to LinkedIn's consent screen
  return NextResponse.redirect(authUrl.toString());
}
