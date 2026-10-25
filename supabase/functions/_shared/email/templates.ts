// Email templates in the Quiet Precision style. Pure TypeScript (no Deno or Node APIs):
// the email-worker renders them, and scripts/email-preview.ts renders them locally.
// Every email has an HTML and a plain-text body. Tables + inline styles for client support.

export type Ctx = {
  appUrl: string;            // https://partneraeo.com
  agencyName?: string;
  recipientName?: string;
  unsubscribeUrl?: string;   // only on optional email (digest, alerts)
  footerAddress?: string;    // company postal address, shown in the footer
};

export type Rendered = { subject: string; preheader: string; html: string; text: string };

const C = {
  bg: "#f5f5f6", surface: "#ffffff", hairline: "#e6e6e9", divider: "#efeff1", edge: "#9da1a8",
  ink: "#08090a", body: "#3c4149", muted: "#62666d", faint: "#8a8f98",
  blue: "#5f86e0", blueInk: "#3d63bd", blueSoft: "#f1f5fd", blueEdge: "#c4d4f5",
  green: "#1d7f34", red: "#c43c3c",
};
const FONT = `Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`; // single quotes: it sits inside style=""

export function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const p = (html: string) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${C.body};">${html}</p>`;

const button = (label: string, href: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr><td style="border:1px solid ${C.edge};border-radius:6px;background:${C.surface};">
    <a href="${esc(href)}" style="display:inline-block;padding:11px 18px;font-family:${FONT};font-size:14px;font-weight:500;color:${C.ink};text-decoration:none;letter-spacing:-0.01em;">${esc(label)}&nbsp;&rarr;</a>
  </td></tr>
</table>`;

const eyebrow = (s: string) =>
  `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:18px;color:${C.blueInk};font-weight:500;">
     <span style="display:inline-block;width:7px;height:7px;border-radius:7px;background:${C.blue};margin-right:7px;vertical-align:1px;"></span>${esc(s)}</p>`;

const h1 = (s: string) =>
  `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:30px;font-weight:500;color:${C.ink};letter-spacing:-0.03em;">${esc(s)}</h1>`;

const steps = (items: [string, string][]) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 20px;border-top:1px solid ${C.hairline};">
  ${items.map(([t, d], i) => `
  <tr>
    <td valign="top" width="34" style="padding:14px 0;border-bottom:1px solid ${C.divider};">
      <div style="width:22px;height:22px;border:1px solid ${C.blueEdge};border-radius:22px;text-align:center;font-family:${FONT};font-size:12px;line-height:22px;color:${C.blueInk};">${i + 1}</div>
    </td>
    <td valign="top" style="padding:14px 0;border-bottom:1px solid ${C.divider};font-family:${FONT};">
      <div style="font-size:14px;line-height:20px;color:${C.ink};font-weight:500;">${t}</div>
      <div style="font-size:14px;line-height:21px;color:${C.muted};margin-top:2px;">${d}</div>
    </td>
  </tr>`).join("")}
</table>`;

function stats(items: { label: string; value: string; delta?: string | null; tone?: "up" | "down" | null }[]) {
  const w = Math.floor(100 / items.length);
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 24px;border:1px solid ${C.hairline};border-radius:6px;border-collapse:separate;">
  <tr>${items.map((s, i) => `
    <td width="${w}%" valign="top" style="padding:14px 16px;${i < items.length - 1 ? `border-right:1px solid ${C.hairline};` : ""}font-family:${FONT};">
      <div style="font-size:12px;line-height:16px;color:${C.faint};">${esc(s.label)}</div>
      <div style="font-size:26px;line-height:32px;color:${C.ink};font-weight:500;letter-spacing:-0.04em;margin-top:4px;">${esc(s.value)}
        ${s.delta ? `<span style="font-size:13px;letter-spacing:0;font-weight:500;color:${s.tone === "down" ? C.red : s.tone === "up" ? C.green : C.faint};">&nbsp;${esc(s.delta)}</span>` : ""}
      </div>
    </td>`).join("")}
  </tr>
</table>`;
}

function layout(o: { preheader: string; body: string; ctx: Ctx; reason: string }) {
  const { ctx } = o;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>Partner AEO</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&display=swap" rel="stylesheet">
<style>
  @media (max-width:600px){ .card{border-radius:0!important;border-left:0!important;border-right:0!important} .pad{padding:24px 20px!important} .stack td{display:block!important;width:100%!important;border-right:0!important;border-bottom:1px solid ${C.hairline}!important} }
  a{color:${C.blueInk}}
</style></head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};">${esc(o.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.bg};">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" class="card" style="width:100%;max-width:560px;background:${C.surface};border:1px solid ${C.hairline};border-radius:8px;">
      <tr><td style="padding:18px 32px;border-bottom:1px solid ${C.hairline};" class="pad">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td style="font-family:${FONT};font-size:14px;font-weight:500;color:${C.ink};letter-spacing:-0.01em;">
            <img src="${esc(ctx.appUrl)}/email/mark.png" width="22" height="22" alt="" style="vertical-align:-6px;margin-right:8px;border:0;">Partner AEO
          </td>
          ${ctx.agencyName ? `<td align="right" style="font-family:${FONT};font-size:13px;color:${C.faint};">${esc(ctx.agencyName)}</td>` : ""}
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px;" class="pad">${o.body}</td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid ${C.hairline};font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};" class="pad">
        ${esc(o.reason)}
        ${ctx.unsubscribeUrl ? `<br><a href="${esc(ctx.unsubscribeUrl)}" style="color:${C.faint};text-decoration:underline;">Unsubscribe from these emails</a> · <a href="${esc(ctx.appUrl)}/settings#notifications" style="color:${C.faint};text-decoration:underline;">Email settings</a>` : ""}
        <br>Partner AEO${ctx.footerAddress ? ` · ${esc(ctx.footerAddress)}` : ""}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const footerText = (ctx: Ctx, reason: string) =>
  `\n\n--\n${reason}${ctx.unsubscribeUrl ? `\nUnsubscribe: ${ctx.unsubscribeUrl}` : ""}\nPartner AEO${ctx.footerAddress ? ` · ${ctx.footerAddress}` : ""}`;

const signed = (n: number | null | undefined, digits = 0) =>
  n == null ? null : `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)}`;

// ---------------------------------------------------------------------------
// App emails
// ---------------------------------------------------------------------------

export function welcome(ctx: Ctx, d: { first_name?: string }): Rendered {
  const hi = d.first_name ? `Welcome, ${d.first_name}` : "Welcome to Partner AEO";
  const subject = `${ctx.agencyName ?? "Your workspace"} is ready on Partner AEO`;
  const preheader = "Your clients and their prompts are set up. Here's what to do first.";
  const reason = `You're getting this because you created ${ctx.agencyName ?? "a workspace"} on Partner AEO.`;
  const html = layout({ ctx, preheader, reason, body: `
    ${eyebrow("Workspace ready")}${h1(hi)}
    ${p(`${esc(ctx.agencyName ?? "Your workspace")} is set up. Every client you added has its buyer prompts written and ready to check on ChatGPT, Gemini, Claude and Perplexity.`)}
    ${p("Three things to do first:")}
    ${steps([
      ["Review each client's prompts", "Edit any question that doesn't sound like their real customers, and add two or three competitors."],
      ["Run your first live check", "Send one prompt to one engine and read the real answer, with the exact cost."],
      ["Invite your team", "Account managers as members, leads as admins. Your trial includes 3 seats."],
    ])}
    ${button("Open your dashboard", `${ctx.appUrl}/dashboard`)}
    ${p(`Questions? Reply to this email and a person will answer.`)}` });
  const text = `${hi}\n\n${ctx.agencyName ?? "Your workspace"} is set up. Every client you added has its buyer prompts written and ready to check.\n\nThree things to do first:\n1. Review each client's prompts and add competitors.\n2. Run your first live check.\n3. Invite your team (3 seats on your trial).\n\nOpen your dashboard: ${ctx.appUrl}/dashboard\n\nQuestions? Reply to this email.${footerText(ctx, reason)}`;
  return { subject, preheader, html, text };
}

export function invite(ctx: Ctx, d: { inviter_name: string; role: string; token: string; to: string }): Rendered {
  const url = `${ctx.appUrl}/signup?invite=${encodeURIComponent(d.token)}&email=${encodeURIComponent(d.to)}`;
  const subject = `${d.inviter_name} invited you to ${ctx.agencyName} on Partner AEO`;
  const preheader = `Join ${ctx.agencyName} to see how AI assistants recommend your clients.`;
  const reason = `${d.inviter_name} invited ${d.to} to ${ctx.agencyName}. If you weren't expecting this, you can ignore it.`;
  const html = layout({ ctx, preheader, reason, body: `
    ${eyebrow("Team invite")}${h1(`Join ${ctx.agencyName} on Partner AEO`)}
    ${p(`${esc(d.inviter_name)} invited you to join <strong style="color:${C.ink};font-weight:500;">${esc(ctx.agencyName)}</strong> as ${d.role === "admin" ? "an admin" : "a member"}.`)}
    ${p("Partner AEO shows how ChatGPT, Gemini, Claude and Perplexity talk about each client your agency manages: who gets named, who gets cited, and who gets left out.")}
    ${button("Accept invite", url)}
    ${p(`Sign up with <strong style="color:${C.ink};font-weight:500;">${esc(d.to)}</strong> and you'll land straight in the workspace.`)}` });
  const text = `${d.inviter_name} invited you to join ${ctx.agencyName} on Partner AEO as ${d.role === "admin" ? "an admin" : "a member"}.\n\nAccept the invite: ${url}\n\nSign up with ${d.to} and you'll land straight in the workspace.${footerText(ctx, reason)}`;
  return { subject, preheader, html, text };
}

export function memberJoined(ctx: Ctx, d: { member_name: string; member_email: string; role: string }): Rendered {
  const subject = `${d.member_name} joined ${ctx.agencyName}`;
  const preheader = `${d.member_name} accepted your invite and can now see every client.`;
  const reason = `You're getting this because you're an owner or admin of ${ctx.agencyName}.`;
  const html = layout({ ctx, preheader, reason, body: `
    ${eyebrow("New teammate")}${h1(`${d.member_name} joined ${ctx.agencyName}`)}
    ${p(`${esc(d.member_name)} (${esc(d.member_email)}) accepted the invite and joined as ${d.role === "admin" ? "an admin" : "a member"}. They can now see and work on every client in the workspace.`)}
    ${button("Manage your team", `${ctx.appUrl}/settings#team`)}` });
  const text = `${d.member_name} (${d.member_email}) joined ${ctx.agencyName} as ${d.role}.\n\nManage your team: ${ctx.appUrl}/settings#team${footerText(ctx, reason)}`;
  return { subject, preheader, html, text };
}

export type DigestData = {
  period: string;                                   // "14 to 20 Oct"
  visibility: number | null; delta: number | null;
  mention_rate: number | null; citation_rate: number | null; answers: number;
  clients: { name: string; domain: string; visibility: number | null; delta: number | null }[];
  sources: { domain: string; count: number }[];
};

export function weeklyDigest(ctx: Ctx, d: DigestData): Rendered {
  const score = d.visibility == null ? "–" : Math.round(d.visibility).toString();
  const delta = signed(d.delta == null ? null : Math.round(d.delta));
  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);
  const subject = `${ctx.agencyName}: AI visibility ${score}${delta ? ` (${delta})` : ""} this week`;
  const preheader = `${d.answers} answers checked across ${d.clients.length} clients, ${d.period}.`;
  const reason = `You're getting the weekly summary for ${ctx.agencyName}.`;
  const movers = [...d.clients].filter((c) => c.delta != null).sort((a, b) => (a.delta! - b.delta!));
  const rows = d.clients.slice(0, 12).map((c) => {
    const dl = c.delta == null ? null : Math.round(c.delta);
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid ${C.divider};font-family:${FONT};font-size:14px;color:${C.ink};">${esc(c.name)}<div style="font-size:12px;color:${C.faint};">${esc(c.domain)}</div></td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid ${C.divider};font-family:${FONT};font-size:14px;color:${C.ink};font-weight:500;">${c.visibility == null ? "–" : Math.round(c.visibility)}</td>
      <td align="right" width="60" style="padding:10px 0;border-bottom:1px solid ${C.divider};font-family:${FONT};font-size:13px;font-weight:500;color:${dl == null || dl === 0 ? C.faint : dl > 0 ? C.green : C.red};">${dl == null ? "–" : signed(dl)}</td>
    </tr>`;
  }).join("");
  const html = layout({ ctx, preheader, reason, body: `
    ${eyebrow(`Weekly summary · ${d.period}`)}${h1(`Your clients' AI visibility this week`)}
    ${stats([
      { label: "Visibility", value: score, delta, tone: d.delta == null ? null : d.delta >= 0 ? "up" : "down" },
      { label: "Mentioned", value: pct(d.mention_rate) },
      { label: "Site cited", value: pct(d.citation_rate) },
    ])}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
      <tr><td style="padding:0 0 8px;font-family:${FONT};font-size:12px;color:${C.faint};border-bottom:1px solid ${C.hairline};">Client</td>
          <td align="right" style="padding:0 0 8px;font-family:${FONT};font-size:12px;color:${C.faint};border-bottom:1px solid ${C.hairline};">Score</td>
          <td align="right" style="padding:0 0 8px;font-family:${FONT};font-size:12px;color:${C.faint};border-bottom:1px solid ${C.hairline};">Change</td></tr>
      ${rows}
    </table>
    ${movers[0] && movers[0].delta! < 0 ? p(`<strong style="color:${C.ink};font-weight:500;">Needs attention:</strong> ${esc(movers[0].name)} dropped ${Math.abs(Math.round(movers[0].delta!))} points.`) : ""}
    ${d.sources.length ? p(`<strong style="color:${C.ink};font-weight:500;">Most cited sources:</strong> ${d.sources.slice(0, 5).map((s) => esc(s.domain)).join(", ")}. Getting clients listed on these sites helps them get recommended.`) : ""}
    ${button("Open the dashboard", `${ctx.appUrl}/dashboard`)}` });
  const text = `${ctx.agencyName} · weekly summary · ${d.period}\n\nVisibility ${score}${delta ? ` (${delta})` : ""} · mentioned ${pct(d.mention_rate)} · site cited ${pct(d.citation_rate)}\n${d.answers} answers checked.\n\n${d.clients.slice(0, 12).map((c) => `${c.name}: ${c.visibility == null ? "–" : Math.round(c.visibility)}${c.delta == null ? "" : ` (${signed(Math.round(c.delta))})`}`).join("\n")}\n\nOpen the dashboard: ${ctx.appUrl}/dashboard${footerText(ctx, reason)}`;
  return { subject, preheader, html, text };
}

export function visibilityDrop(ctx: Ctx, d: { client_id: string; client_name: string; client_domain: string; before: number; after: number }): Rendered {
  const drop = Math.round(d.before - d.after);
  const subject = `${d.client_name} dropped ${drop} points in AI visibility`;
  const preheader = `From ${Math.round(d.before)} to ${Math.round(d.after)} this week. See which answers changed.`;
  const reason = `You're getting alerts for ${ctx.agencyName}.`;
  const html = layout({ ctx, preheader, reason, body: `
    ${eyebrow("Visibility alert")}${h1(`${d.client_name} dropped ${drop} points`)}
    ${stats([
      { label: "Last week", value: String(Math.round(d.before)) },
      { label: "This week", value: String(Math.round(d.after)), delta: signed(-drop), tone: "down" },
    ])}
    ${p(`AI assistants named ${esc(d.client_name)} (${esc(d.client_domain)}) less often this week. Open the client to see which prompts and engines changed, and which competitors were recommended instead.`)}
    ${button(`Open ${d.client_name}`, `${ctx.appUrl}/clients/${encodeURIComponent(d.client_id)}`)}` });
  const text = `${d.client_name} dropped ${drop} points in AI visibility (${Math.round(d.before)} → ${Math.round(d.after)}).\n\nSee what changed: ${ctx.appUrl}/clients/${d.client_id}${footerText(ctx, reason)}`;
  return { subject, preheader, html, text };
}

export function limitReached(ctx: Ctx, d: { what: "clients" | "seats"; limit: number; plan: string }): Rendered {
  const noun = d.what === "clients" ? "client slots" : "seats";
  const subject = `You've used all ${d.limit} ${noun} on ${ctx.agencyName}`;
  const preheader = d.what === "clients" ? "Upgrade to keep adding clients." : "Upgrade to invite more teammates.";
  const reason = `You're getting this because you own ${ctx.agencyName}.`;
  const html = layout({ ctx, preheader, reason, body: `
    ${eyebrow("Plan limit")}${h1(`All ${d.limit} ${noun} are in use`)}
    ${p(d.what === "clients"
      ? `${esc(ctx.agencyName)} is tracking ${d.limit} clients, the most your ${esc(d.plan)} plan includes. Everything keeps working; you just can't add another client until you upgrade or archive one.`
      : `${esc(ctx.agencyName)} has used all ${d.limit} seats on your ${esc(d.plan)} plan, including pending invites. Upgrade, or revoke an unused invite, to add someone else.`)}
    ${button("See plans", `${ctx.appUrl}/billing`)}` });
  const text = `${ctx.agencyName} has used all ${d.limit} ${noun} on the ${d.plan} plan.\n\nSee plans: ${ctx.appUrl}/billing${footerText(ctx, reason)}`;
  return { subject, preheader, html, text };
}

export function trialEnding(ctx: Ctx, d: { trial_ends_at: string; clients: number }): Rendered {
  const date = new Date(d.trial_ends_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const subject = `Your Partner AEO trial ends on ${date}`;
  const preheader = `Pick a plan to keep tracking your ${d.clients} clients.`;
  const reason = `You're getting this because you own ${ctx.agencyName}.`;
  const html = layout({ ctx, preheader, reason, body: `
    ${eyebrow("Trial ending")}${h1(`Your trial ends on ${date}`)}
    ${p(`${esc(ctx.agencyName)} is tracking ${d.clients} ${d.clients === 1 ? "client" : "clients"}. Choose a plan before ${esc(date)} to keep the weekly checks, history and reports running. Nothing is deleted when a trial ends.`)}
    ${steps([
      ["Starter · $149 a month", "10 clients, 3 seats, weekly scans."],
      ["Growth · $349 a month", "30 clients, 10 seats, on-demand checks."],
      ["Scale · $899 a month", "100 clients, 50 seats."],
    ])}
    ${button("Choose a plan", `${ctx.appUrl}/billing`)}` });
  const text = `Your Partner AEO trial for ${ctx.agencyName} ends on ${date}.\n\nChoose a plan to keep tracking your ${d.clients} clients: ${ctx.appUrl}/billing${footerText(ctx, reason)}`;
  return { subject, preheader, html, text };
}

// ---------------------------------------------------------------------------
// Supabase Auth templates (pasted into Authentication > Emails). They keep the
// {{ .ConfirmationURL }} style placeholders Supabase fills in.
// ---------------------------------------------------------------------------

export const AUTH_TEMPLATES = {
  confirmation: { subject: "Confirm your email for Partner AEO", title: "Confirm your email", eyebrow: "One more step",
    body: "Confirm this email address to finish creating your Partner AEO workspace.", cta: "Confirm email",
    note: "If you didn't sign up for Partner AEO, you can ignore this email." },
  recovery: { subject: "Reset your Partner AEO password", title: "Reset your password", eyebrow: "Password reset",
    body: "Someone asked to reset the password for {{ .Email }}. Choose a new one with the button below. The link works once and expires in an hour.", cta: "Choose a new password",
    note: "If you didn't ask for this, ignore this email and your password stays the same." },
  magic_link: { subject: "Your Partner AEO sign-in link", title: "Sign in to Partner AEO", eyebrow: "Sign-in link",
    body: "Use the button below to sign in as {{ .Email }}. The link works once and expires in an hour.", cta: "Sign in",
    note: "If you didn't ask to sign in, you can ignore this email." },
  email_change: { subject: "Confirm your new email for Partner AEO", title: "Confirm your new email", eyebrow: "Email change",
    body: "Confirm that you want to change your Partner AEO email from {{ .Email }} to {{ .NewEmail }}.", cta: "Confirm new email",
    note: "If you didn't ask for this change, contact us right away by replying to this email." },
} as const;

export function authTemplate(kind: keyof typeof AUTH_TEMPLATES, appUrl: string): { subject: string; html: string } {
  const t = AUTH_TEMPLATES[kind];
  const html = layout({
    ctx: { appUrl }, preheader: t.body.replace(/\{\{[^}]+\}\}/g, "you"), reason: t.note,
    body: `${eyebrow(t.eyebrow)}${h1(t.title)}${p(t.body)}${button(t.cta, "{{ .ConfirmationURL }}")}
      ${p(`<span style="font-size:13px;color:${C.faint};">Button not working? Paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:${C.blueInk};word-break:break-all;">{{ .ConfirmationURL }}</a></span>`)}`,
  });
  return { subject: t.subject, html };
}
