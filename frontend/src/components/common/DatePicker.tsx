import React, { useEffect, useMemo, useRef, useState } from "react";
import { BTN_SM } from "../../utils/ui";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDateString(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string): string {
  const parsed = parseDateString(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1, 12));
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

function clampVisibleMonth(date: Date, min?: string, max?: string): Date {
  const minDate = min ? parseDateString(min) : null;
  const maxDate = max ? parseDateString(max) : null;
  let next = startOfMonth(date);
  if (minDate) { const minMonth = startOfMonth(minDate); if (next < minMonth) next = minMonth; }
  if (maxDate) { const maxMonth = startOfMonth(maxDate); if (next > maxMonth) next = maxMonth; }
  return next;
}

const popoverStyle: React.CSSProperties = {
  backgroundColor: "#111",
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(10,10,10,0.96) 0%, rgba(16,16,16,0.96) 45%, rgba(40,32,0,0.98) 100%)",
  backgroundSize: "6px 6px, 100% 100%",
};

const DatePicker: React.FC<Props> = ({
  id,
  value,
  onChange,
  disabled = false,
  min,
  max,
  placeholder = "Choose date",
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = useMemo(() => parseDateString(value), [value]);
  const minDate = useMemo(() => (min ? parseDateString(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseDateString(max) : null), [max]);
  const initialVisibleMonth = useMemo(() => {
    const today = new Date();
    const fallback = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12));
    return clampVisibleMonth(selectedDate ?? fallback, min, max);
  }, [max, min, selectedDate]);

  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(initialVisibleMonth);

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth((current) => {
        const selectedMonth = startOfMonth(selectedDate);
        return isSameUtcDay(current, selectedMonth) ? current : selectedMonth;
      });
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const monthDays = useMemo(() => {
    const year = visibleMonth.getUTCFullYear();
    const month = visibleMonth.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1, 12));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < firstDay.getUTCDay(); i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(Date.UTC(year, month, day, 12)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [visibleMonth]);

  const canGoPrev = useMemo(() => {
    if (!minDate) return true;
    return addMonths(visibleMonth, -1) >= startOfMonth(minDate);
  }, [minDate, visibleMonth]);

  const canGoNext = useMemo(() => {
    if (!maxDate) return true;
    return addMonths(visibleMonth, 1) <= startOfMonth(maxDate);
  }, [maxDate, visibleMonth]);

  function selectDate(date: Date) {
    onChange(toIsoDate(date));
    setOpen(false);
  }

  function isDisabledDate(date: Date): boolean {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  }

  return (
    <div className="relative" ref={rootRef}>
      {/* Trigger */}
      <button
        id={id}
        className={[
          "input flex items-center justify-between gap-3 text-left cursor-pointer",
          open
            ? "border-[rgba(245,213,70,0.42)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(245,213,70,0.18),0_0_18px_rgba(245,213,70,0.10)]"
            : "",
        ].join(" ")}
        type="button"
        onClick={() => !disabled && setOpen((c) => !c)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "" : "text-white/[0.42]"}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <span className="shrink-0 text-[0.72rem] tracking-[0.12em] text-[#f2c46f] opacity-90" aria-hidden="true">
          ▼
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute top-[calc(100%+0.5rem)] left-0 z-40 w-[min(320px,calc(100vw-2rem))] p-[0.85rem] rounded-[14px] border border-[rgba(245,213,70,0.35)] shadow-[0_16px_36px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.03)]"
          style={popoverStyle}
          role="dialog"
          aria-label="Choose date"
        >
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 mb-[0.85rem]">
            <button
              className={BTN_SM}
              type="button"
              onClick={() => setVisibleMonth((c) => addMonths(c, -1))}
              disabled={!canGoPrev}
            >
              Prev
            </button>

            <div className="flex flex-col items-center gap-[0.15rem] text-center">
              <strong className="text-[#f5d546] uppercase">{MONTH_NAMES[visibleMonth.getUTCMonth()]}</strong>
              <span className="text-[0.85rem] text-white/70">{visibleMonth.getUTCFullYear()}</span>
            </div>

            <button
              className={BTN_SM}
              type="button"
              onClick={() => setVisibleMonth((c) => addMonths(c, 1))}
              disabled={!canGoNext}
            >
              Next
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-[0.35rem] mb-2">
            {WEEKDAY_NAMES.map((day) => (
              <span key={day} className="text-center text-[0.78rem] tracking-[0.08em] uppercase text-white/55">
                {day}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-[0.35rem]">
            {monthDays.map((date, index) => {
              if (!date) {
                return <span key={`blank-${index}`} className="min-h-[38px]" />;
              }

              const disabledDay = isDisabledDate(date);
              const selectedDay = selectedDate ? isSameUtcDay(date, selectedDate) : false;
              const today = isSameUtcDay(date, new Date());

              return (
                <button
                  key={toIsoDate(date)}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => selectDate(date)}
                  className={[
                    "min-h-[38px] rounded-[10px] border font-tektur text-[0.92rem] cursor-pointer",
                    "transition-[border-color,background,transform] duration-[180ms] ease-in-out",
                    selectedDay
                      ? "border-[rgba(245,213,70,0.55)] bg-[rgba(245,213,70,0.16)] text-white shadow-[inset_0_0_0_1px_rgba(245,213,70,0.12)]"
                      : today
                      ? "border-[rgba(246,163,0,0.4)] bg-[rgba(255,255,255,0.03)] text-white/90 hover:border-[rgba(245,213,70,0.35)] hover:bg-[rgba(245,213,70,0.08)]"
                      : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-white/90 hover:border-[rgba(245,213,70,0.35)] hover:bg-[rgba(245,213,70,0.08)]",
                    disabledDay ? "opacity-[0.28] cursor-not-allowed" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {date.getUTCDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between gap-2 mt-[0.85rem]">
            <button
              className={BTN_SM}
              type="button"
              onClick={() => {
                const today = new Date();
                const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12));
                setVisibleMonth(startOfMonth(todayUtc));
                if (!isDisabledDate(todayUtc)) { onChange(toIsoDate(todayUtc)); setOpen(false); }
              }}
            >
              Today
            </button>
            <button className={BTN_SM} type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
