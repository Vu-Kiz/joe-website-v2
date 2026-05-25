import { useRef, useEffect, useState } from "react";

export type TabItem<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  items: TabItem<T>[];
  activeKey: T;
  onChange: (key: T) => void;
};

function SlideTabNav<T extends string>({ items, activeKey, onChange }: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLElement>("[data-active='true']");
    if (!activeBtn) return;

    setIndicator({
      left: activeBtn.offsetLeft,
      width: activeBtn.offsetWidth,
    });

    activeBtn.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeKey]);

  return (
    <div className="mb-4">
      {/* Mobile: native select dropdown */}
      <div className="md:hidden">
        <select
          value={activeKey}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm font-bold text-white appearance-none cursor-pointer focus:outline-none focus:border-[#f5d546]/50"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff99' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
        >
          {items.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop: sliding tab bar */}
      <div
        ref={containerRef}
        className="relative mx-auto hidden w-full justify-start overflow-x-auto border-b border-white/[0.08] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex md:justify-center"
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              data-active={isActive ? "true" : "false"}
              onClick={() => onChange(item.key)}
              className={[
                "relative z-10 min-h-[44px] whitespace-nowrap px-4",
                "border-none bg-transparent cursor-pointer",
                "font-tektur text-[0.82rem] font-bold tracking-[0.04em] uppercase",
                "transition-colors duration-150",
                isActive ? "text-[#f5d546]" : "text-white/45 hover:text-white/80",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}

        {/* Sliding indicator */}
        <span
          className="absolute bottom-[-1px] h-[2px] rounded-t-sm bg-[#f5d546] shadow-[0_0_8px_rgba(245,213,70,0.4)] transition-[left,width] duration-200 ease-in-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>
    </div>
  );
}

export default SlideTabNav;
