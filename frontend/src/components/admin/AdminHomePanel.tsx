import React from "react";
type Props = {
  showSystemTools: boolean;
  canSeeLogs: boolean;
};

type AdminCard = {
  key: string;
  title: string;
  description: string;
  hidden?: boolean;
};

const AdminHomePanel: React.FC<Props> = ({ showSystemTools, canSeeLogs }) => {
  const cards: AdminCard[] = [
    {
      key: "tips",
      title: "Tips",
      description:
        "Manage the loading screen tip pool. Create new tips, edit wording, and remove outdated entries.",
    },
    {
      key: "tenets",
      title: "Tenets",
      description:
        "Update the Tenets of Salvage reference content that appears on the site and in admin tooling.",
    },
    {
      key: "eotm",
      title: "EoTM",
      description:
        "Manage Employee of the Month entries, including BBCode reason text and uploaded employee images.",
    },
    {
      key: "weather",
      title: "Weather",
      description:
        "Control Tatooine weather generation, including the daily min/max range, adjective bands, and advice pool.",
    },
    {
      key: "users",
      title: "Users",
      description:
        "Review users and manage admin-level and content-management permissions. Sysadmin remains database-only.",
    },
    {
      key: "memberChangelog",
      title: "Change Log",
      description:
        "Manage backend-driven member changelog entries and generate/update entries from README patch-note sections.",
    },
    {
      key: "websiteHealth",
      title: "Website Health",
      description:
        "Check backend health, database status, queue pressure, frontend connectivity, and writable runtime paths.",
      hidden: !showSystemTools,
    },
    {
      key: "discordBot",
      title: "Discord Bot",
      description:
        "Review bot server presence, invite it to new guilds, and check announcement routing and channel config state.",
      hidden: !showSystemTools,
    },
    {
      key: "siteLock",
      title: "Site Lock",
      description:
        "Enable or disable the site lock and control the message shown while the website is restricted.",
      hidden: !showSystemTools,
    },
    {
      key: "combatValues",
      title: "Combat Values",
      description:
        "Manage DB-backed combat modifiers like damage-type values and ship-class matrices used by combat tooling.",
      hidden: !showSystemTools,
    },
    {
      key: "entityStats",
      title: "Entity Stats",
      description:
        "Edit stored entity catalog records and run admin helpers for station and material icon population.",
      hidden: !showSystemTools,
    },
    {
      key: "system",
      title: "System",
      description:
        "Use sysadmin-only infrastructure and higher-risk system operations like pull tooling and refresh controls.",
      hidden: !showSystemTools,
    },
    {
      key: "logs",
      title: "Action Log",
      description:
        "Review admin activity history with before-and-after audit details for tracked changes across the site.",
      hidden: !canSeeLogs,
    },
    {
      key: "memberAccessLogs",
      title: "Member Access",
      description:
        "Review member tool entry and activity history without the routine bootstrap noise from background support requests.",
      hidden: !canSeeLogs,
    },
  ];

  return (
    <div className="admin-grid">
      {cards
        .filter((card) => !card.hidden)
        .map((card) => (
          <section key={card.key} className="panel admin-card">
            <div className="admin-card__header">
              <h3 className="admin-card__title">{card.title}</h3>
              <p className="admin-card__desc">{card.description}</p>
            </div>
          </section>
        ))}
    </div>
  );
};

export default AdminHomePanel;
