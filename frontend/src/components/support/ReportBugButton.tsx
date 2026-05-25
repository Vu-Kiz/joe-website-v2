import React, { useState } from "react";
import { BTN_GHOST_SM } from "../../utils/ui";
import TicketCreateModal from "./TicketCreateModal";
import TicketListPanel from "./TicketListPanel";
import type { SupportTicket } from "../../api/support/supportTickets";

type Props = {
  toolKey: string;
  toolLabel: string;
};

const ReportBugButton: React.FC<Props> = ({ toolKey, toolLabel }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [showList, setShowList] = useState(false);
  const [successTicket, setSuccessTicket] = useState<SupportTicket | null>(null);

  function handleSuccess(ticket: SupportTicket) {
    setShowCreate(false);
    setSuccessTicket(ticket);
    setTimeout(() => setSuccessTicket(null), 4000);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" className={BTN_GHOST_SM} onClick={() => setShowCreate(true)}>
          Report a Bug
        </button>
        <button type="button" className={BTN_GHOST_SM} onClick={() => setShowList(true)}>
          My Tickets
        </button>
        {successTicket && (
          <span className="text-[0.78rem] text-[#8ef0a0]">
            ✓ Ticket #{successTicket.id} submitted
          </span>
        )}
      </div>

      {showCreate && (
        <TicketCreateModal
          toolKey={toolKey}
          toolLabel={toolLabel}
          onClose={() => setShowCreate(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showList && (
        <TicketListPanel onClose={() => setShowList(false)} />
      )}
    </>
  );
};

export default ReportBugButton;
