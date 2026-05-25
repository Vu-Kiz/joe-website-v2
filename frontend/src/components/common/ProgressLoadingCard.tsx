import React, { useEffect, useMemo, useState } from "react";
import jawaLogo from "../../assets/branding/jawalogo.png";

const rootCls = (compact: boolean) =>
  compact
    ? "flex w-full items-center justify-center p-0 text-white"
    : "fixed inset-0 z-[9999] flex items-center justify-center p-[40px] text-white";

const cardCls = (compact: boolean) =>
  "w-full flex flex-col items-center justify-center bg-[rgba(17,17,17,0.85)] border border-[rgba(245,213,70,0.35)] rounded-[12px] shadow-[0_18px_40px_rgba(0,0,0,0.55)]" +
  (compact
    ? " max-w-[720px] min-h-0 gap-[18px] p-[28px_32px]"
    : " max-w-[840px] min-h-[460px] gap-7 p-[64px_72px] max-[900px]:max-w-full max-[900px]:p-[40px_28px] max-[900px]:min-h-0 max-[520px]:p-[32px_20px]");

const LOGO_IMG_CLS = "object-contain";
const titleCls = (compact: boolean) =>
  "font-semibold text-center m-0 leading-[1.4]" + (compact ? " text-[1.2rem]" : " text-[1.5rem] max-[900px]:text-[1.25rem]");
const barCls = (compact: boolean) =>
  "w-full max-w-[560px] h-[16px] rounded-full border border-[rgba(245,213,70,0.35)] bg-[rgba(0,0,0,0.65)] overflow-hidden shadow-[inset_0_0_6px_rgba(0,0,0,0.7)]" +
  (compact ? "" : " mt-3");
const FILL_CLS = "h-full rounded-[inherit] bg-[linear-gradient(90deg,#f5d546,#f8e27a)] [background-size:200%_100%] animate-loading-shimmer transition-[width] duration-[250ms] ease-out";
const metaCls = (compact: boolean) =>
  "w-full max-w-[560px] flex justify-between items-center gap-[18px]" + (compact ? "" : " mt-[10px]");
const VALUE_CLS = "text-[1.8rem] font-bold max-[520px]:text-[1.4rem]";
const HINT_CLS = "text-[1rem] text-white/60 text-right flex-1";
const tipsCls = (compact: boolean) =>
  "w-full max-w-[560px] p-[16px_18px] bg-[rgba(0,0,0,0.6)] rounded-[8px] border border-dashed border-[rgba(245,213,70,0.35)]" +
  (compact ? "" : " mt-[14px]");
const TIP_TEXT_CLS = "text-[0.95rem] mb-[6px]";

type ProgressLoadingCardProps = {
  title: string;
  stages: string[];
  tip?: string;
  compact?: boolean;
  className?: string;
  progress?: number | null;
};

const ProgressLoadingCard: React.FC<ProgressLoadingCardProps> = ({
  title,
  stages,
  tip,
  compact = false,
  className = "",
  progress: controlledProgress = null,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (controlledProgress != null) {
      setProgress(Math.max(0, Math.min(100, controlledProgress)));
      return;
    }

    let frame: number | null = null;
    let cancelled = false;
    let progressValue = 0;
    const startedAt = Date.now();

    const tick = () => {
      if (cancelled) {
        return;
      }

      const elapsedMs = Date.now() - startedAt;
      let target = 0;

      if (elapsedMs < 2500) {
        target = 18 + (elapsedMs / 2500) * 44;
      } else if (elapsedMs < 6000) {
        target = 62 + ((elapsedMs - 2500) / 3500) * 26;
      } else if (elapsedMs < 12000) {
        target = 88 + ((elapsedMs - 6000) / 6000) * 8;
      } else if (elapsedMs < 24000) {
        target = 96 + ((elapsedMs - 12000) / 12000) * 2.4;
      } else {
        target = 98.4 + Math.min(0.5, ((elapsedMs - 24000) / 20000) * 0.5);
      }

      const remaining = target - progressValue;
      const step = remaining <= 0 ? 0.04 : Math.max(0.08, remaining * 0.18);
      progressValue = Math.min(98.9, +(progressValue + step).toFixed(2));
      setProgress(progressValue);
      frame = window.setTimeout(tick, 180) as unknown as number;
    };

    tick();

    return () => {
      cancelled = true;
      if (frame != null) {
        window.clearTimeout(frame);
      }
    };
  }, [controlledProgress]);

  const currentStage = useMemo(() => {
    if (stages.length === 0) {
      return "Preparing…";
    }

    const stageIndex = Math.min(
      stages.length - 1,
      Math.floor((Math.min(progress, 100) / 100) * stages.length)
    );

    return stages[stageIndex] ?? stages[stages.length - 1];
  }, [progress, stages]);

  return (
    <div className={[rootCls(compact), className].filter(Boolean).join(" ")}>
      <div className={cardCls(compact)}>
        <div className="flex justify-center items-center">
          <img
            src={jawaLogo}
            alt="Jawa Offworld Enterprises"
            className={LOGO_IMG_CLS}
            style={{ width: compact ? 56 : 72, height: compact ? 56 : 72 }}
          />
        </div>

        <h1 className={titleCls(compact)}>{title}</h1>

        <div className={barCls(compact)}>
          <div className={FILL_CLS} style={{ width: `${progress}%` }} />
        </div>

        <div className={metaCls(compact)}>
          <div className={VALUE_CLS}>{progress.toFixed(0)}%</div>
          <div className={HINT_CLS}>{currentStage}</div>
        </div>

        {tip ? (
          <div className={tipsCls(compact)}>
            <div className={TIP_TEXT_CLS}>{tip}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ProgressLoadingCard;
