import React, { useEffect, useMemo, useState } from "react";
import jawaLogo from "../../assets/branding/jawalogo.png";
import styles from "../../styles/loading.module.sass";

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

  const rootClassName = [
    compact ? styles.inlineRoot : styles.root,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const cardClassName = [
    styles.card,
    compact ? styles.cardCompact : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      <div className={cardClassName}>
        <div className={styles.logo}>
          <img src={jawaLogo} alt="Jawa Offworld Enterprises" />
        </div>

        <h1 className={styles.title}>{title}</h1>

        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: `${progress}%` }} />
        </div>

        <div className={styles.meta}>
          <div className={styles.value}>{progress.toFixed(0)}%</div>
          <div className={styles.hint}>{currentStage}</div>
        </div>

        {tip ? (
          <div className={styles.tips}>
            <div className={styles.tipText}>{tip}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ProgressLoadingCard;
