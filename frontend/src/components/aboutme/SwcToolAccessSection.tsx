import { BTN_SM } from "../../utils/ui";

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
    <div className="grid gap-2">
      <h2 className="h2 mb-0">{title}</h2>

      <p className="muted m-0 text-sm">{description}</p>

      <button
        className={BTN_SM + " w-full sm:w-auto sm:self-start"}
        type="button"
        onClick={onConnect}
        disabled={!canConnect}
      >
        {actionLabel}
      </button>

      {!hasSelectedTools && <p className="small m-0 mt-0.5">{emptySelectionMessage}</p>}

      <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((tool) => (
          <section
            key={tool.key}
            className="grid gap-2 rounded-xl border border-white/15 bg-white/[0.04] p-2.5"
          >
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-start">
              <h3 className="m-0">{tool.title}</h3>
            </div>

            <p className="muted m-0 text-sm leading-snug">{tool.description}</p>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-white/70">Access now</span>
              <strong>{tool.accessNow ? "Yes" : "No"}</strong>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`rounded-full border px-2.5 py-1.5 text-xs font-bold transition ${
                  tool.enabled
                    ? "border-[#f5d546]/45 bg-[#f5d546]/15 text-[#ffe7a0]"
                    : "border-white/20 bg-white/10 text-white/85"
                }`}
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
    </div>
  );
}

export default SwcToolAccessSection;
