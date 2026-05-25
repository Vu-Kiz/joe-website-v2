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
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <h2 className="h2">{title}</h2>
        <p className="small">{message}</p>
      </header>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h3 className="m-0">Authentication required</h3>
            <p className="m-0 opacity-[0.85]">
              Please log in with your website account and try again.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NotLoggedInState;