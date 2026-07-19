export function formatMarketName(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const BADGE_BASE = "rounded-[4px] text-[0.7rem] font-semibold px-[0.45rem] py-[0.15rem] uppercase tracking-[0.05em]";

export const BADGE_CLS: Record<string, string> = {
  faction: `${BADGE_BASE} bg-[rgba(100,180,255,0.12)] text-[#7cc4ff]`,
  member:  `${BADGE_BASE} bg-[rgba(140,220,140,0.12)] text-[#8fe1a8]`,
  public:  `${BADGE_BASE} bg-white/[0.08] text-white/80`,
  restricted: `${BADGE_BASE} bg-[rgba(245,158,11,0.14)] text-[#fbbf24]`,
  entity:  `${BADGE_BASE} bg-white/[0.07] text-white/70`,
  custom:  `${BADGE_BASE} bg-[rgba(200,150,255,0.12)] text-[#c9a0ff]`,
  bundle:  `${BADGE_BASE} bg-[rgba(255,180,80,0.12)] text-[#ffc166]`,
  stock:   `${BADGE_BASE} bg-[rgba(100,220,200,0.12)] text-[#5ddec8]`,
};

export const CARD_CLS = "bg-white/[0.03] border border-white/[0.08] rounded-[12px] flex flex-col gap-[0.45rem] p-[0.82rem] hover:border-white/[0.14] transition-[border-color] duration-150 font-tektur";

export const EMPTY_CLS = "text-white/40 text-[0.9rem] py-8";

export const FILTER_CHIP_CLS = (active: boolean) =>
  `bg-transparent cursor-pointer text-[0.78rem] px-[0.7rem] py-[0.25rem] rounded-[20px] transition-[background,color,border-color] duration-150 border  font-tektur${
    active
      ? "bg-white/10 border-white/[0.28] text-white"
      : "border-white/10 text-white/55 hover:bg-white/[0.05] hover:text-white/85"
  }`;

export const FORM_ROW_CLS = "flex flex-col gap-[0.35rem]";
export const FORM_LABEL_CLS = "text-[0.82rem] opacity-75";
