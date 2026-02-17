import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

const AppLayout: React.FC = () => {
  return (
    <div className="site-scale">
      <Navbar />
      <Outlet />
    </div>
  );
};

export default AppLayout;
