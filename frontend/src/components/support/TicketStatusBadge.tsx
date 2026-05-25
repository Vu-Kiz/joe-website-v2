import React from "react";
import type { TicketSeverity, TicketStatus } from "../../api/support/supportTickets";

const STATUS_STYLES: Record<TicketStatus, string> = {
  open:        "bg-[rgba(245,213,70,0.12)] border-[rgba(245,213,70,0.3)] text-[#f2c46f]",
  in_progress: "bg-[rgba(100,160,255,0.12)] border-[rgba(100,160,255,0.3)] text-[#7eb8ff]",
  resolved:    "bg-white/[0.06] border-white/[0.15] text-white/40",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open:        "Open",
  in_progress: "In Progress",
  resolved:    "Resolved",
};

const SEVERITY_STYLES: Record<TicketSeverity, string> = {
  tool_breaking: "bg-[rgba(255,80,80,0.12)] border-[rgba(255,80,80,0.3)] text-[#ff7070]",
  major_bug:     "bg-[rgba(255,160,60,0.12)] border-[rgba(255,160,60,0.3)] text-[#ffb060]",
  minor_bug:     "bg-[rgba(245,213,70,0.12)] border-[rgba(245,213,70,0.3)] text-[#f2c46f]",
  visual_ui:     "bg-[rgba(100,160,255,0.12)] border-[rgba(100,160,255,0.3)] text-[#7eb8ff]",
};

const SEVERITY_LABELS: Record<TicketSeverity, string> = {
  tool_breaking: "Tool Breaking",
  major_bug:     "Major Bug",
  minor_bug:     "Minor Bug",
  visual_ui:     "Visual / UI",
};

type Props = { status: TicketStatus } | { severity: TicketSeverity };

const TicketStatusBadge: React.FC<Props> = (props) => {
  if ("status" in props) {
    return (
      <span className={`text-[0.7rem] uppercase tracking-[0.08em] font-semibold border rounded px-[6px] py-[2px] ${STATUS_STYLES[props.status]}`}>
        {STATUS_LABELS[props.status]}
      </span>
    );
  }
  return (
    <span className={`text-[0.7rem] uppercase tracking-[0.08em] font-semibold border rounded px-[6px] py-[2px] ${SEVERITY_STYLES[props.severity]}`}>
      {SEVERITY_LABELS[props.severity]}
    </span>
  );
};

export default TicketStatusBadge;
