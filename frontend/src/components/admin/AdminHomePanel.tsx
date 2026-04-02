import React from "react";

type Props = {
  showSystemTools: boolean;
};

const AdminHomePanel: React.FC<Props> = ({ showSystemTools }) => {
  return (
    <div className="admin-grid">
      <section className="panel admin-card">
        <div className="admin-card__header">
          <h3 className="admin-card__title">Tips</h3>
          <p className="admin-card__desc">
            Manage the loading screen tip pool. Create new tips, edit wording,
            and remove outdated entries.
          </p>
        </div>
      </section>

      <section className="panel admin-card">
        <div className="admin-card__header">
          <h3 className="admin-card__title">EoTM</h3>
          <p className="admin-card__desc">
            Manage Employee of the Month entries, including BBCode reason text
            and uploaded employee images.
          </p>
        </div>
      </section>

      <section className="panel admin-card">
        <div className="admin-card__header">
          <h3 className="admin-card__title">Weather</h3>
          <p className="admin-card__desc">
            Control Tatooine weather generation, including the daily min/max
            range, adjective bands, and advice pool.
          </p>
        </div>
      </section>

      <section className="panel admin-card">
        <div className="admin-card__header">
          <h3 className="admin-card__title">Users</h3>
          <p className="admin-card__desc">
            Review users and manage admin-level and content-management
            permissions. Sysadmin remains database-only.
          </p>
        </div>
      </section>

      {showSystemTools && (
        <section className="panel admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Discord Bot</h3>
            <p className="admin-card__desc">
              Review bot server presence, invite it to new guilds, and check announcement routing.
            </p>
          </div>
        </section>
      )}

      {showSystemTools && (
        <section className="panel admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Action Log</h3>
            <p className="admin-card__desc">
              Review admin and JEN activity with expandable audit details.
            </p>
          </div>
        </section>
      )}

      {showSystemTools && (
        <section className="panel admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">System</h3>
            <p className="admin-card__desc">
              Sysadmin-only controls for infrastructure and higher-risk system
              operations.
            </p>
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminHomePanel;
