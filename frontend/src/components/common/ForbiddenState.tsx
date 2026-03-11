import React from "react";
import { Link } from "react-router-dom";

type Props = {
  title?: string;
  message?: string;
};

const ForbiddenState: React.FC<Props> = ({
  title = "403 Forbidden",
  message = "You do not have permission to access this area.",
}) => {
  return (
    <div className="panel status-panel forbidden-state">
      <h1 style={{ marginTop: 0 }}>{title}</h1>
      <p className="small">{message}</p>

      <div className="status-panel__actions">
        <Link className="btn btn--small" to="/home">
          Home
        </Link>
      </div>
    </div>
  );
};

export default ForbiddenState;