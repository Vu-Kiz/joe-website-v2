import React, { useEffect, useMemo, useRef, useState } from "react";

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
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDateString(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

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

  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1, 12));
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate()
  );
}

function clampVisibleMonth(date: Date, min?: string, max?: string): Date {
  const minDate = min ? parseDateString(min) : null;
  const maxDate = max ? parseDateString(max) : null;
  let next = startOfMonth(date);

  if (minDate) {
    const minMonth = startOfMonth(minDate);
    if (next < minMonth) {
      next = minMonth;
    }
  }

  if (maxDate) {
    const maxMonth = startOfMonth(maxDate);
    if (next > maxMonth) {
      next = maxMonth;
    }
  }

  return next;
}

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
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
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
    const leadingBlanks = firstDay.getUTCDay();
    const cells: Array<Date | null> = [];

    for (let i = 0; i < leadingBlanks; i += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(Date.UTC(year, month, day, 12)));
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [visibleMonth]);

  const canGoPrev = useMemo(() => {
    if (!minDate) {
      return true;
    }

    return addMonths(visibleMonth, -1) >= startOfMonth(minDate);
  }, [minDate, visibleMonth]);

  const canGoNext = useMemo(() => {
    if (!maxDate) {
      return true;
    }

    return addMonths(visibleMonth, 1) <= startOfMonth(maxDate);
  }, [maxDate, visibleMonth]);

  function selectDate(date: Date) {
    onChange(toIsoDate(date));
    setOpen(false);
  }

  function isDisabledDate(date: Date): boolean {
    if (minDate && date < minDate) {
      return true;
    }

    if (maxDate && date > maxDate) {
      return true;
    }

    return false;
  }

  return (
    <div className="joe-date-picker" ref={rootRef}>
      <button
        id={id}
        className={`input joe-date-picker__trigger ${open ? "is-open" : ""}`}
        type="button"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "" : "joe-date-picker__placeholder"}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <span className="joe-date-picker__icon" aria-hidden="true">
          ▼
        </span>
      </button>

      {open && (
        <div className="joe-date-picker__popover" role="dialog" aria-label="Choose date">
          <div className="joe-date-picker__header">
            <button
              className="btn btn--sm"
              type="button"
              onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
              disabled={!canGoPrev}
            >
              Prev
            </button>

            <div className="joe-date-picker__title">
              <strong>{MONTH_NAMES[visibleMonth.getUTCMonth()]}</strong>
              <span>{visibleMonth.getUTCFullYear()}</span>
            </div>

            <button
              className="btn btn--sm"
              type="button"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              disabled={!canGoNext}
            >
              Next
            </button>
          </div>

          <div className="joe-date-picker__weekdays">
            {WEEKDAY_NAMES.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="joe-date-picker__grid">
            {monthDays.map((date, index) => {
              if (!date) {
                return <span key={`blank-${index}`} className="joe-date-picker__blank" />;
              }

              const disabledDay = isDisabledDate(date);
              const selectedDay = selectedDate ? isSameUtcDay(date, selectedDate) : false;
              const today = isSameUtcDay(date, new Date());

              return (
                <button
                  key={toIsoDate(date)}
                  className={`joe-date-picker__day ${selectedDay ? "is-selected" : ""} ${today ? "is-today" : ""}`}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => selectDate(date)}
                >
                  {date.getUTCDate()}
                </button>
              );
            })}
          </div>

          <div className="joe-date-picker__footer">
            <button
              className="btn btn--sm"
              type="button"
              onClick={() => {
                const today = new Date();
                const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12));
                setVisibleMonth(startOfMonth(todayUtc));
                if (!isDisabledDate(todayUtc)) {
                  onChange(toIsoDate(todayUtc));
                  setOpen(false);
                }
              }}
            >
              Today
            </button>

            <button className="btn btn--sm" type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
