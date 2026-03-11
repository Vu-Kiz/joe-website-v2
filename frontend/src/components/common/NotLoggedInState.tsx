import React from "react";

type Props = {
  title?: string;
  message?: string;
};

const NotLoggedInState: React.FC<Props> = ({
  title = "Not logged in",
  message = "You need to sign in to access this area.",
}) => {
  return (
    <section className="admin-panel">
      <header className="admin-panel__header">
        <h2>{title}</h2>
        <p className="small">{message}</p>
      </header>

      <div className="admin-panel__body">
        <div className="admin-card">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Authentication required</h3>
            <p className="admin-card__desc">
              Please log in with your website account and try again.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NotLoggedInState;