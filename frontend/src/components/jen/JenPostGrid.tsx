import React from "react";
import type { BlogPost } from "../../api/content/blog";
import type { SwcUser } from "../../api/core/auth";
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
  const hasOpen = !!overlayOpenId;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-start">
      {posts.map((post) => (
        <JenPostCard
          key={post.id}
          post={post}
          isOverlayOpen={overlayOpenId === post.id}
          dimmed={hasOpen && overlayOpenId !== post.id}
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
