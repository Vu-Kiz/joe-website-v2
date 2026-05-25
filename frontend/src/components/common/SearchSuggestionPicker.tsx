import React from "react";

type SearchSuggestionPickerProps<T> = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  autoComplete?: string;
  suggestions: T[];
  showSuggestions: boolean;
  onShowSuggestions: (show: boolean) => void;
  getKey: (item: T, index: number) => string;
  isActive?: (item: T) => boolean;
  onSelect: (item: T) => void;
  renderSuggestion: (item: T, active: boolean) => React.ReactNode;
  className?: string;
};

function SearchSuggestionPicker<T>({
  id,
  value,
  onChange,
  onSubmit,
  onFocus,
  placeholder,
  autoComplete = "off",
  suggestions,
  showSuggestions,
  onShowSuggestions,
  getKey,
  isActive,
  onSelect,
  renderSuggestion,
  className = "",
}: SearchSuggestionPickerProps<T>) {
  return (
    <div className={`relative w-full min-w-0 ${className}`}>
      <input
        id={id}
        className="w-full min-h-[44px] px-[0.95rem] py-3 rounded-[12px] border border-white/10 bg-[#111] text-white/[0.94] outline-none appearance-none transition-[border-color,box-shadow] duration-[180ms] placeholder:text-white/[0.42] hover:border-[rgba(245,213,70,0.18)] focus:border-[rgba(245,213,70,0.42)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_6px_18px_rgba(0,0,0,0.18)] disabled:opacity-65 disabled:cursor-not-allowed"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          onShowSuggestions(true);
        }}
        onFocus={() => {
          onShowSuggestions(true);
          onFocus?.();
        }}
        onBlur={() => {
          window.setTimeout(() => onShowSuggestions(false), 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit?.();
          }
        }}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />

      {showSuggestions && suggestions.length ? (
        <div className="absolute top-full left-0 right-0 z-[10] mt-1 border border-white/[0.1] rounded-[10px] bg-[#111] shadow-[0_8px_24px_rgba(0,0,0,0.32)] overflow-y-auto max-h-[240px]">
          {suggestions.map((item, index) => {
            const active = isActive ? isActive(item) : false;

            return (
              <button
                key={getKey(item, index)}
                type="button"
                className={`w-full flex flex-col gap-[2px] px-3 py-[0.55rem] text-left text-[0.82rem] transition-colors duration-100 bg-surface hover:bg-white/5 ${active ? "bg-[rgba(245,213,70,0.08)]! text-[#f2c46f]" : "text-[#f2c46f]"}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(item);
                  onShowSuggestions(false);
                }}
              >
                {renderSuggestion(item, active)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default SearchSuggestionPicker;
