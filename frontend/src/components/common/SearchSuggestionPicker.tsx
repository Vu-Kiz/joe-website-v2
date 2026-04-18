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
  const rootClassName = ["members-universe__typeahead", className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <input
        id={id}
        className="input"
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
        style={{ minWidth: 0 }}
      />

      {showSuggestions && suggestions.length ? (
        <div className="members-universe__typeahead-list">
          {suggestions.map((item, index) => {
            const active = isActive ? isActive(item) : false;

            return (
              <button
                key={getKey(item, index)}
                type="button"
                className={`members-universe__typeahead-option${active ? " is-active" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(item);
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
