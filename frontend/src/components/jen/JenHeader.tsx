import React from "react";
import { Link } from "react-router-dom";

type Props = {
  canCreate: boolean;
  manageMode: boolean;
};

const JenHeader: React.FC<Props> = ({ canCreate, manageMode }) => {
  return (
    <div className="jen-header-row">

      {canCreate && (
        <div className="jen-header-row__actions">
          {!manageMode ? (
            <Link className="btn btn--small" to="/jen?manage=1">
              Editor Mode
            </Link>
          ) : (
            <>
              <Link className="btn btn--small" to="/jen?create=1&manage=1">
                Create Post
              </Link>

              <Link className="btn btn--small" to="/jen">
                Exit Editor
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default JenHeader;