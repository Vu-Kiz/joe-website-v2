import React from "react";
import jawaLogo from "../../assets/branding/jawalogo.png";
import styles from "../../styles/loading.module.sass";

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
  const rootClassName = [compact ? styles.inlineRoot : styles.root, className]
    .filter(Boolean)
    .join(" ");

  const cardClassName = [styles.card, compact ? styles.cardCompact : "", styles.spinnerCard]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      <div className={cardClassName}>
        <div className={styles.logo}>
          <img src={jawaLogo} alt="Jawa Offworld Enterprises" />
        </div>

        <div className={styles.spinner} aria-hidden="true" />

        <h1 className={styles.title}>{title}</h1>

        {tip ? (
          <div className={styles.tips}>
            <div className={styles.tipText}>{tip}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SpinnerLoadingCard;
