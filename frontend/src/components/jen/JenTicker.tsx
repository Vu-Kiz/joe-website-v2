import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listBlog, type BlogPost } from "../../api/blog";
import jenTickerLogo from "../../assets/branding/JENLogo.png";

import "../../styles/_ticker.sass";

const JenTicker: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await listBlog();
        if (cancelled) return;

        const latest = (res.posts ?? []).slice(0, 5);
        setPosts(latest);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load ticker");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const tickerItems = useMemo(() => {
    if (!posts.length) return [];
    return [...posts, ...posts];
  }, [posts]);

  if (error || !posts.length) {
    return null;
  }

  return (
    <div className="jen-ticker-shell" aria-label="JEN latest news ticker">
      <div className="jen-ticker">
        <div className="jen-ticker__label">
          <img
            src={jenTickerLogo}
            alt="JEN"
            className="jen-ticker__logo"
          />
        </div>

        <div className="jen-ticker__viewport">
          <div className="jen-ticker__track">
            {tickerItems.map((post, index) => {
              const cgt = post.cgt_created?.trim()
                ? post.cgt_created.trim()
                : "CGT Unknown";

              return (
                <span className="jen-ticker__item" key={`${post.id}-${index}`}>
                  <span className="jen-ticker__cgt">[{cgt}]</span>

                  <Link
                    to={`/jen?post=${post.id}`}
                    className="jen-ticker__title"
                    title={post.title}
                  >
                    {post.title}
                  </Link>

                  <span className="jen-ticker__author">
                    — by {post.author_handle ?? "Unknown"}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JenTicker;