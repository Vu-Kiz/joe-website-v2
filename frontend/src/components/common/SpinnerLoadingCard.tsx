import React from "react";
import jawaLogo from "../../assets/branding/jawalogo.png";

const rootCls = (compact: boolean) =>
  compact
    ? "flex w-full items-center justify-center p-0 text-white"
    : "fixed inset-0 z-[9999] flex items-center justify-center p-[40px] text-white";

const cardCls = (compact: boolean) =>
  "w-full max-w-[640px] min-h-0 flex flex-col items-center justify-center bg-[rgba(17,17,17,0.85)] border border-[rgba(245,213,70,0.35)] rounded-[12px] shadow-[0_18px_40px_rgba(0,0,0,0.55)]" +
  (compact
    ? " gap-[18px] p-[28px_32px]"
    : " gap-7 p-[64px_72px] max-[900px]:max-w-full max-[900px]:p-[40px_28px] max-[520px]:p-[32px_20px]");

const SPINNER_CLS = "w-[42px] h-[42px] rounded-full border-[3px] border-[rgba(245,213,70,0.22)] border-t-[#f5d546] animate-spinner-rotate";
const titleCls = (compact: boolean) =>
  "font-semibold text-center m-0 leading-[1.4]" + (compact ? " text-[1.2rem]" : " text-[1.5rem] max-[900px]:text-[1.25rem]");
const TIP_CLS = "w-full max-w-[560px] p-[16px_18px] bg-[rgba(0,0,0,0.6)] rounded-[8px] border border-dashed border-[rgba(245,213,70,0.35)]";
const TIP_TEXT_CLS = "text-[0.95rem] mb-[6px]";

type SpinnerLoadingCardProps = {
  title: string;
  tip?: string;
  compact?: boolean;
  className?: string;
};

const SpinnerLoadingCard: React.FC<SpinnerLoadingCardProps> = ({
  title,
  tip,
  compact = false,
  className = "",
}) => {
  return (
    <div className={[rootCls(compact), className].filter(Boolean).join(" ")}>
      <div className={cardCls(compact)}>
        <div className="flex justify-center items-center">
          <img
            src={jawaLogo}
            alt="Jawa Offworld Enterprises"
            className="object-contain"
            style={{ width: compact ? 56 : 72, height: compact ? 56 : 72 }}
          />
        </div>

        <div className={SPINNER_CLS} aria-hidden="true" />

        <h1 className={titleCls(compact)}>{title}</h1>

        {tip ? (
          <div className={TIP_CLS}>
            <div className={TIP_TEXT_CLS}>{tip}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SpinnerLoadingCard;
