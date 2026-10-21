import { GB, US, CA, AU, NZ, IE, DE, FR, ES, IT, NL, BE, SE, NO, DK, FI, CH, AT, PT, PL, AE, SG, IN, ZA, BR, MX, JP } from "country-flag-icons/react/3x2";
import type { FlagComponent } from "country-flag-icons/react/3x2";

type Flag = FlagComponent;

export type Region = { code: string; name: string; group: "Europe" | "Americas" | "Asia Pacific" | "Middle East & Africa" | "Global"; Flag?: Flag };

export const REGIONS: Region[] = [
  { code: "GB", name: "United Kingdom", group: "Europe", Flag: GB },
  { code: "US", name: "United States", group: "Americas", Flag: US },
  { code: "CA", name: "Canada", group: "Americas", Flag: CA },
  { code: "AU", name: "Australia", group: "Asia Pacific", Flag: AU },
  { code: "IE", name: "Ireland", group: "Europe", Flag: IE },
  { code: "DE", name: "Germany", group: "Europe", Flag: DE },
  { code: "FR", name: "France", group: "Europe", Flag: FR },
  { code: "ES", name: "Spain", group: "Europe", Flag: ES },
  { code: "IT", name: "Italy", group: "Europe", Flag: IT },
  { code: "NL", name: "Netherlands", group: "Europe", Flag: NL },
  { code: "BE", name: "Belgium", group: "Europe", Flag: BE },
  { code: "SE", name: "Sweden", group: "Europe", Flag: SE },
  { code: "NO", name: "Norway", group: "Europe", Flag: NO },
  { code: "DK", name: "Denmark", group: "Europe", Flag: DK },
  { code: "FI", name: "Finland", group: "Europe", Flag: FI },
  { code: "CH", name: "Switzerland", group: "Europe", Flag: CH },
  { code: "AT", name: "Austria", group: "Europe", Flag: AT },
  { code: "PT", name: "Portugal", group: "Europe", Flag: PT },
  { code: "PL", name: "Poland", group: "Europe", Flag: PL },
  { code: "NZ", name: "New Zealand", group: "Asia Pacific", Flag: NZ },
  { code: "SG", name: "Singapore", group: "Asia Pacific", Flag: SG },
  { code: "IN", name: "India", group: "Asia Pacific", Flag: IN },
  { code: "JP", name: "Japan", group: "Asia Pacific", Flag: JP },
  { code: "AE", name: "United Arab Emirates", group: "Middle East & Africa", Flag: AE },
  { code: "ZA", name: "South Africa", group: "Middle East & Africa", Flag: ZA },
  { code: "BR", name: "Brazil", group: "Americas", Flag: BR },
  { code: "MX", name: "Mexico", group: "Americas", Flag: MX },
  { code: "GLOBAL", name: "Global", group: "Global" },
];

export const regionByCode = (code: string) => REGIONS.find((r) => r.code === code);

export function FlagIcon({ code, size = 18 }: { code: string; size?: number }) {
  const r = regionByCode(code);
  const h = Math.round((size * 2) / 3);
  if (!r?.Flag) {
    return (
      <span aria-hidden className="inline-grid place-items-center rounded-[2px] border border-hairline text-faint" style={{ width: size, height: h }}>
        <svg width={h - 2} height={h - 2} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
        </svg>
      </span>
    );
  }
  const F = r.Flag;
  return <F aria-hidden style={{ width: size, height: h, borderRadius: 2, boxShadow: "0 0 0 1px rgba(8,9,10,.08)", flex: "none", display: "block" }} />;
}

export const CLIENT_BANDS = [
  { id: "1-5", label: "1 to 5", hint: "Boutique" },
  { id: "6-20", label: "6 to 20", hint: "Growing" },
  { id: "21-50", label: "21 to 50", hint: "Established" },
  { id: "51-100", label: "51 to 100", hint: "Scaling" },
  { id: "100+", label: "100+", hint: "Enterprise" },
];
