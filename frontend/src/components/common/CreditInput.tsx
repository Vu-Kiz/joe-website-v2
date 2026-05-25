import React from "react";

/**
 * Parses a comma-formatted credit string (e.g. "1,000,000") to a number.
 * Returns NaN if the string is empty or invalid.
 */
export function parseCreditInput(value: string): number {
  return parseInt(value.replace(/,/g, ""), 10);
}

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

/**
 * A credit/price input that allows comma-separated number formatting (e.g. 1,000,000).
 * Stores raw string with commas; use parseCreditInput() to convert to a number on submit.
 */
const CreditInput: React.FC<Props> = ({ value, onChange, ...rest }) => {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d,]/g, ""))}
    />
  );
};

export default CreditInput;
