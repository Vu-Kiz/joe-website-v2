import React from "react";
import type { BlogPost } from "../../api/blog";
import type { SwcUser } from "../../api/auth";
import JenPostCard from "./JenPostCard";

type Props = {
  posts: BlogPost[];
  overlayOpenId: number | null;
  user: SwcUser | null;
  busyDeleteId: number | null;
  manageMode: boolean;
  onOpenFromCard: (post: BlogPost, element: HTMLElement) => void;
  onCloseOverlay: () => void;
  onDelete: (post: BlogPost) => void;
};

const JenPostGrid: React.FC<Props> = ({
  posts,
  overlayOpenId,
  user,
  busyDeleteId,
  manageMode,
  onOpenFromCard,
  onCloseOverlay,
  onDelete,
}) => {
  return (
    <div className={"jen-grid" + (overlayOpenId ? " jen-grid--has-open" : "")}>
      {posts.map((post) => (
        <JenPostCard
          key={post.id}
          post={post}
          isOverlayOpen={overlayOpenId === post.id}
          user={user}
          busyDelete={busyDeleteId === post.id}
          manageMode={manageMode}
          onOpenFromCard={onOpenFromCard}
          onCloseOverlay={onCloseOverlay}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default JenPostGrid;