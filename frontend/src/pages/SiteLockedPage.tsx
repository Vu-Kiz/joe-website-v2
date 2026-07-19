import React from "react";

type Props = {
  message: string;
};

const SiteLockedPage: React.FC<Props> = ({ message }) => {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <h1 className="text-3xl font-bold mb-4">Site Locked</h1>
        <p className="text-neutral-300 mb-6">{message}</p>

        <div className="flex gap-3">
          <a
            href="/oauth"
            className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-black font-medium"
          >
            Login
          </a>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-neutral-700 px-4 py-2 font-tektur"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
};

export default SiteLockedPage;