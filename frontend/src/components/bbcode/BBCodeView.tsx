// src/components/BBCodeView.tsx
import React from "react";
import { bbcodeToHtml } from "../../utils/bbcode";

type Props = {
  value: string;
  className?: string;
};

const BBCodeView: React.FC<Props> = ({ value, className }) => {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: bbcodeToHtml(value ?? "") }}
    />
  );
};

export default BBCodeView;