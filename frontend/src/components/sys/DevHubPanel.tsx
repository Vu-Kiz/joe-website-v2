import React, { useCallback, useState } from "react";
import SlideTabNav from "../common/SlideTabNav";
import KanbanBoard from "./KanbanBoard";
import AdminSupportTicketsPanel from "../admin/AdminSupportTicketsPanel";
import TicketBoardView from "../admin/TicketBoardView";

type DevHubTab = "board" | "tickets";
type TicketsView = "list" | "kanban";

const TABS = [
  { key: "board" as const,   label: "Task Board" },
  { key: "tickets" as const, label: "Support Tickets" },
];

const DevHubPanel: React.FC = () => {
  const [tab, setTab] = useState<DevHubTab>("board");
  const [ticketsView, setTicketsView] = useState<TicketsView>("kanban");

  const handleTicketsChanged = useCallback(() => {
    // no-op: each view manages its own state
  }, []);

  return (
    <section className="panel">
      <h2 className="h2 mt-0 mb-1">Dev Hub</h2>
      <p className="small mt-0 mb-4">Task tracking and support tickets in one place.</p>

      <SlideTabNav items={TABS} activeKey={tab} onChange={setTab} />

      {tab === "board" && <KanbanBoard />}

      {tab === "tickets" && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              className={"text-[0.75rem] px-3 py-1 rounded-lg border transition-colors duration-100  font-tektur" + (ticketsView === "kanban" ? "border-[rgba(245,213,70,0.4)] bg-[rgba(245,213,70,0.08)] text-[#f2c46f]" : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70")}
              onClick={() => setTicketsView("kanban")}
            >
              Board
            </button>
            <button
              type="button"
              className={"text-[0.75rem] px-3 py-1 rounded-lg border transition-colors duration-100  font-tektur" + (ticketsView === "list" ? "border-[rgba(245,213,70,0.4)] bg-[rgba(245,213,70,0.08)] text-[#f2c46f]" : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70")}
              onClick={() => setTicketsView("list")}
            >
              List
            </button>
          </div>
          {ticketsView === "kanban" && <TicketBoardView onTicketsChanged={handleTicketsChanged} />}
          {ticketsView === "list"   && <AdminSupportTicketsPanel />}
        </>
      )}
    </section>
  );
};

export default DevHubPanel;
