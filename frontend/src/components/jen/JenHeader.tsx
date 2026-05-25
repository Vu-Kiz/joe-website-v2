import React from "react";
import { Link } from "react-router-dom";
import { BTN_SM, BTN_GHOST_SM } from "../../utils/ui";

type Props = {
  canCreate: boolean;
  manageMode: boolean;
};

const JenHeader: React.FC<Props> = ({ canCreate, manageMode }) => {
  if (!canCreate) return null;

  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        {!manageMode ? (
          <Link className={BTN_SM} to="/jen?manage=1">Editor Mode</Link>
        ) : (
          <>
            <Link className={BTN_SM} to="/jen?create=1&manage=1">Create Post</Link>
            <Link className={BTN_GHOST_SM} to="/jen">Exit Editor</Link>
          </>
        )}
      </div>
    </div>
  );
};

export default JenHeader;
