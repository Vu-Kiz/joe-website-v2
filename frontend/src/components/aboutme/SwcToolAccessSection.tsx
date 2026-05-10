export type SwcToolCard<K extends string> = {
  key: K;
  title: string;
  description: string;
  enabled: boolean;
  accessNow: boolean;
};

type Props<K extends string> = {
  title: string;
  description: string;
  cards: Array<SwcToolCard<K>>;
  hasSelectedTools: boolean;
  isConnected: boolean;
  allowConnectWhenEmpty?: boolean;
  onConnect: () => void;
  onToggle: (tool: K) => void;
  connectLabel: string;
  resyncLabel: string;
  emptySelectionActionLabel?: string;
  emptySelectionMessage: string;
};

function SwcToolAccessSection<K extends string>({
  title,
  description,
  cards,
  hasSelectedTools,
  isConnected,
  allowConnectWhenEmpty = false,
  onConnect,
  onToggle,
  connectLabel,
  resyncLabel,
  emptySelectionActionLabel,
  emptySelectionMessage,
}: Props<K>) {
  const canConnect = hasSelectedTools || allowConnectWhenEmpty;
  const actionLabel =
    !hasSelectedTools && emptySelectionActionLabel
      ? emptySelectionActionLabel
      : (isConnected ? resyncLabel : connectLabel);

  return (
    <>
      <h2 className="h2">{title}</h2>

      <p className="muted">{description}</p>

      <button className="btn" type="button" onClick={onConnect} disabled={!canConnect}>
        {actionLabel}
      </button>

      {!hasSelectedTools && (
        <p className="small">{emptySelectionMessage}</p>
      )}

      <div className="aboutme-access-grid">
        {cards.map((tool) => (
          <section key={tool.key} className="aboutme-access-card">
            <div className="aboutme-access-row">
              <h3 className="aboutme-access-title">{tool.title}</h3>
            </div>

            <p className="muted aboutme-access-copy">{tool.description}</p>

            <div className="aboutme-access-status-row">
              <span className="small">Access now</span>
              <strong>{tool.accessNow ? "Yes" : "No"}</strong>
            </div>

            <div className="aboutme-access-actions">
              <button
                className={`aboutme-access-toggle${tool.enabled ? " aboutme-access-toggle--on" : ""}`}
                type="button"
                aria-pressed={tool.enabled}
                onClick={() => onToggle(tool.key)}
              >
                {tool.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default SwcToolAccessSection;
