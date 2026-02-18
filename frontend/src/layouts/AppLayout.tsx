import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

const AppLayout: React.FC = () => {
  return (
    <>
      <div className="page-shell">
        <Navbar />
      </div>

      <div className="page-shell">
        <Outlet />
      </div>
    </>
  );
};

export default AppLayout;
