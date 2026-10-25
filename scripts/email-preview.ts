// Renders every email with sample data to emails/preview/*.html, and writes the
// Supabase Auth templates to supabase/templates/*.html (paste into Authentication > Emails).
//   npm run email:preview
import { mkdirSync, writeFileSync } from "node:fs";
import * as T from "../supabase/functions/_shared/email/templates.ts";

const appUrl = process.env.APP_URL ?? "https://partneraeo.com";
const ctx: T.Ctx = { appUrl, agencyName: "Orbit Digital", footerAddress: "Partner AEO Ltd, 1 Example Street, London" };
const optional = { ...ctx, unsubscribeUrl: `${appUrl}/unsubscribe?t=00000000-0000-0000-0000-000000000000&k=weekly_digest` };

const emails: Record<string, T.Rendered> = {
  "01-welcome": T.welcome(ctx, { first_name: "Alex" }),
  "02-invite": T.invite(ctx, { inviter_name: "Alex Morgan", role: "member", token: "8d5c0b7e-0000-4000-8000-000000000000", to: "sam@orbit.digital" }),
  "03-member-joined": T.memberJoined(ctx, { member_name: "Sam Lee", member_email: "sam@orbit.digital", role: "member" }),
  "04-weekly-digest": T.weeklyDigest(optional, {
    period: "14 Oct to 21 Oct", visibility: 54.2, delta: 4.1, mention_rate: 0.61, citation_rate: 0.23, answers: 160,
    clients: [
      { name: "Northgate Dental", domain: "northgatedental.co.uk", visibility: 72, delta: 6 },
      { name: "Halden & Rowe", domain: "haldenrowe.com", visibility: 58, delta: 3 },
      { name: "Kestrel Facilities", domain: "kestrelfacilities.co.uk", visibility: 39, delta: 9 },
      { name: "Brightwater CRM", domain: "brightwatercrm.com", visibility: 31, delta: -12 },
    ],
    sources: [{ domain: "reddit.com", count: 44 }, { domain: "g2.com", count: 39 }, { domain: "trustpilot.com", count: 31 }],
  }),
  "05-visibility-drop": T.visibilityDrop({ ...optional, unsubscribeUrl: optional.unsubscribeUrl.replace("weekly_digest", "alerts") },
    { client_id: "c1", client_name: "Brightwater CRM", client_domain: "brightwatercrm.com", before: 43, after: 31 }),
  "06-limit-clients": T.limitReached(ctx, { what: "clients", limit: 10, plan: "trial" }),
  "07-limit-seats": T.limitReached(ctx, { what: "seats", limit: 3, plan: "trial" }),
  "08-trial-ending": T.trialEnding(ctx, { trial_ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString(), clients: 8 }),
};

mkdirSync("emails/preview", { recursive: true });
const index: string[] = [];
for (const [name, r] of Object.entries(emails)) {
  writeFileSync(`emails/preview/${name}.html`, r.html);
  writeFileSync(`emails/preview/${name}.txt`, `Subject: ${r.subject}\n\n${r.text}`);
  index.push(`${name}: ${r.subject}`);
}
mkdirSync("supabase/templates", { recursive: true });
for (const k of Object.keys(T.AUTH_TEMPLATES) as (keyof typeof T.AUTH_TEMPLATES)[]) {
  const t = T.authTemplate(k, appUrl);
  writeFileSync(`supabase/templates/${k}.html`, t.html);
  writeFileSync(`emails/preview/auth-${k}.html`, t.html.replaceAll("{{ .ConfirmationURL }}", `${appUrl}/onboarding#example`).replaceAll("{{ .Email }}", "alex@orbit.digital").replaceAll("{{ .NewEmail }}", "alex@new.agency"));
  index.push(`auth/${k}: ${t.subject}`);
}
console.log(index.join("\n"));
