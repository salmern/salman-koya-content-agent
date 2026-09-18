/**
 * LinkedIn OAuth — Step 2: Exchange code for access token
 *
 * LinkedIn redirects here after the user approves access.
 * We exchange the code for an access token and then fetch the user's profile URN.
 * Both values are displayed so you can copy them into .env.local.
 *
 * This page is intentionally read-only — it never auto-stores credentials.
 * You manually copy the values shown into .env.local.
 */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return html(`
      <h2>LinkedIn authorisation failed</h2>
      <p><strong>Error:</strong> ${error}</p>
      <p><strong>Description:</strong> ${errorDescription ?? "none"}</p>
      <p><a href="/auth/linkedin">Try again</a></p>
    `);
  }

  if (!code) {
    return html(`<p>No authorisation code received. <a href="/auth/linkedin">Try again</a></p>`);
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = `${origin}/auth/linkedin/callback`;

  if (!clientSecret || clientSecret === "your-primary-client-secret-here") {
    return html(`
      <h2>Missing client secret</h2>
      <p>Set <code>LINKEDIN_CLIENT_SECRET</code> in <code>.env.local</code> to the value shown on the Auth tab of your LinkedIn app, then restart the dev server and try again.</p>
    `);
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return html(`
      <h2>Token exchange failed</h2>
      <p>Status: ${tokenRes.status}</p>
      <pre>${body}</pre>
    `);
  }

  const tokenData = await tokenRes.json();
  const accessToken: string = tokenData.access_token;
  const expiresIn: number = tokenData.expires_in; // seconds
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toLocaleDateString();

  // Fetch LinkedIn profile to get the person URN
  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let personUrn = "unknown";
  let displayName = "";

  if (profileRes.ok) {
    const profile = await profileRes.json();
    // The "sub" field is the person's ID
    personUrn = `urn:li:person:${profile.sub}`;
    displayName = profile.name ?? profile.email ?? "";
  }

  return html(`
    <style>
      body { font-family: system-ui, sans-serif; max-width: 680px; margin: 40px auto; padding: 0 20px; color: #0f172a; }
      h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
      .subtitle { color: #64748b; font-size: 14px; margin-bottom: 32px; }
      .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px 24px; margin-bottom: 16px; }
      .label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
      .value { font-family: monospace; font-size: 13px; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px 12px; word-break: break-all; user-select: all; cursor: text; }
      .expires { font-size: 12px; color: #94a3b8; margin-top: 6px; }
      .step { font-size: 14px; line-height: 1.7; margin-bottom: 24px; }
      .step code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
      .warning { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-bottom: 24px; }
    </style>

    <h1>✓ LinkedIn connected</h1>
    <p class="subtitle">
      ${displayName ? `Signed in as <strong>${displayName}</strong>. ` : ""}
      Copy the two values below into <code>.env.local</code>.
    </p>

    <div class="warning">
      ⚠ Do not share these values or commit them to git. They grant full posting access to your LinkedIn account.
    </div>

    <div class="card">
      <div class="label">LINKEDIN_ACCESS_TOKEN</div>
      <div class="value">${accessToken}</div>
      <div class="expires">Expires: ${expiresAt} (${Math.round(expiresIn / 86400)} days)</div>
    </div>

    <div class="card">
      <div class="label">LINKEDIN_AUTHOR_URN</div>
      <div class="value">${personUrn}</div>
    </div>

    <div class="step">
      <strong>Next steps:</strong>
      <ol>
        <li>Open <code>.env.local</code></li>
        <li>Replace <code>LINKEDIN_ACCESS_TOKEN</code> with the value above</li>
        <li>Replace <code>LINKEDIN_AUTHOR_URN</code> with the value above</li>
        <li>Set <code>PUBLISHING_PROVIDER=real</code></li>
        <li>Restart the dev server (<code>Ctrl+C</code> → <code>npm run dev</code>)</li>
      </ol>
      The token lasts ${Math.round(expiresIn / 86400)} days. When it expires, visit
      <a href="/auth/linkedin">this page</a> again to get a new one.
    </div>
  `);
}

function html(body: string): NextResponse {
  return new NextResponse(`<!DOCTYPE html><html><body>${body}</body></html>`, {
    headers: { "Content-Type": "text/html" },
  });
}
