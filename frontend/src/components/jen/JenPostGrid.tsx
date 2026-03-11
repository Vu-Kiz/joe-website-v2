import React from "react";
import type { BlogPost } from "../../api/blog";
import type { SwcUser } from "../../api/auth";
import JenPostCard from "./JenPostCard";

type Props = {
  posts: BlogPost[];
  openId: number | null;
  user: SwcUser | null;
  busyDeleteId: number | null;
  manageMode: boolean;
  onToggle: (id: number) => void;
  onDelete: (post: BlogPost) => void;
};

const JenPostGrid: React.FC<Props> = ({
  posts,
  openId,
  user,
  busyDeleteId,
  manageMode,
  onToggle,
  onDelete,
}) => {
  return (
    <div className="jen-grid">
      {posts.map((post) => (
        <JenPostCard
          key={post.id}
          post={post}
          isOpen={openId === post.id}
          user={user}
          busyDelete={busyDeleteId === post.id}
          manageMode={manageMode}
          onToggle={() => onToggle(post.id)}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default JenPostGrid;