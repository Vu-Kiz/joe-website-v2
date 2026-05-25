import React from "react";
import type { SwcUser } from "../../api/core/auth";
import { isAdmin, isSysadmin } from "../../auth/permissions";

type Props = {
  user: SwcUser | null;
};

const AdminHeader: React.FC<Props> = ({ user }) => {
  return (
    <div className="panel flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col">
        <h1 className="m-0 mb-1.5">Admin Control</h1>
        <p className="small m-0">
          Signed in as <strong>{user?.handle ?? "Unknown"}</strong>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {isAdmin(user) && (
          <span className="inline-flex min-h-8 items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.82rem] font-bold">
            Admin
          </span>
        )}
        {isSysadmin(user) && (
          <span className="inline-flex min-h-8 items-center rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-[0.82rem] font-bold text-amber-200">
            Sysadmin
          </span>
        )}
      </div>
    </div>
  );
};

export default AdminHeader;
