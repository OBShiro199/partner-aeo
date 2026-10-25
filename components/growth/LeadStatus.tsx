import type { LeadStatus } from "@/lib/types";
import { cx } from "@/components/ui";

export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "meeting", "won", "lost"];
const TONE: Record<LeadStatus, string> = { new: "tag-blue", contacted: "tag-violet", meeting: "tag-amber", won: "tag-green", lost: "" };

export function LeadStatusTag({ status }: { status: LeadStatus }) {
  return <span className={cx("tag capitalize", TONE[status])}>{status}</span>;
}
