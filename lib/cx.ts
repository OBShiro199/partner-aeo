export function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}
