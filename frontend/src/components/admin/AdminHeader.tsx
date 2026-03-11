import React from "react";
import type { SwcUser } from "../../api/auth";
import { isAdmin, isSysadmin } from "../../auth/permissions";

type Props = {
  user: SwcUser | null;
};

const AdminHeader: React.FC<Props> = ({ user }) => {
  return (
    <div className="panel admin-header">
      <div className="admin-header__copy">
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem" }}>Admin Control</h1>
        <p className="small" style={{ margin: 0 }}>
          Signed in as <strong>{user?.handle ?? "Unknown"}</strong>
        </p>
      </div>

      <div className="admin-header__badges">
        {isAdmin(user) && <span className="admin-badge">Admin</span>}
        {isSysadmin(user) && (
          <span className="admin-badge admin-badge--strong">Sysadmin</span>
        )}
      </div>
    </div>
  );
};

export default AdminHeader;