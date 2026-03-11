import React from "react";

const AdminSystemPanel: React.FC = () => {
  return (
    <section className="panel admin-panel">
      <div className="admin-panel__header">
        <h2 style={{ margin: 0 }}>System</h2>
        <p className="small" style={{ margin: 0 }}>
          Sysadmin-only infrastructure tools render here inline.
        </p>
      </div>

      <div className="admin-panel__body">
        <p className="small">This is the inline SPA area for system tools.</p>
      </div>
    </section>
  );
};

export default AdminSystemPanel;