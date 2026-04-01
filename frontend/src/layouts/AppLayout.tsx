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

      <footer className="page-footer">
        <div className="page-shell">
          <div className="page-footer__copy">
            <p className="page-footer__brand">&copy; 2026 Jawa Offworld Enterprises</p>
            <p className="page-footer__credit">Developed by Anarchy Industries</p>
            <p className="page-footer__credit">Designed by Sarlacc Integrated Design</p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default AppLayout;