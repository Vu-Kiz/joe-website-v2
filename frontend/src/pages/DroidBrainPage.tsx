import React, { useEffect } from "react";
import MemberDroidBrainPanel from "../components/members/MemberDroidBrainPanel";
import { logMemberToolOpen } from "../api/members/memberTools";

const DroidBrainPage: React.FC = () => {
  useEffect(() => {
    void logMemberToolOpen("droidbrain", "/intel/droidbrain").catch(() => {});
  }, []);

  return <MemberDroidBrainPanel />;
};

export default DroidBrainPage;
