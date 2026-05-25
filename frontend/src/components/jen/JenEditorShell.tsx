import React from "react";
import type { BlogPost } from "../../api/content/blog";
import BlogEditorPanel from "./JenEditorPanel";

type Props = {
  mode: "create" | "edit";
  post?: BlogPost | null;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
};

const JenEditorShell: React.FC<Props> = ({
  mode,
  post = null,
  onCancel,
  onSaved,
}) => {
  return (
    <BlogEditorPanel
      mode={mode}
      post={post}
      onCancel={onCancel}
      onSaved={onSaved}
    />
  );
};

export default JenEditorShell;