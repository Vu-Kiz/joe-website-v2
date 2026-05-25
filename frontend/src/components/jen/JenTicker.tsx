import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listBlog, type BlogPost } from "../../api/content/blog";
import jenTickerLogo from "../../assets/branding/JENLogo.png";

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
    <div className="relative z-10 mb-4 rounded-[10px] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.28)] border border-[rgba(245,213,70,0.35)] bg-[#111]" aria-label="JEN latest news ticker">
      <div className="flex items-stretch min-h-[54px] w-full max-[768px]:min-h-[46px]">
        <div className="flex-none flex items-center justify-center px-[0.9rem] border-r border-white/[0.12] bg-white/[0.02] max-[768px]:px-[0.7rem]">
          <img
            src={jenTickerLogo}
            alt="JEN"
            className="block max-h-[34px] w-auto object-contain max-[768px]:max-h-[28px]"
          />
        </div>

        <div className="jen-ticker__viewport relative flex-1 min-w-0 overflow-hidden flex items-center">
          <div className="jen-ticker__track inline-flex items-center gap-8 w-max whitespace-nowrap px-4 animate-ticker-scroll">
            {tickerItems.map((post, index) => {
              const cgt = post.cgt_created?.trim()
                ? post.cgt_created.trim()
                : "CGT Unknown";

              return (
                <span className="inline-flex items-center gap-[0.45rem] text-white/[0.92] text-[0.95rem] max-[768px]:text-[0.85rem]" key={`${post.id}-${index}`}>
                  <span className="text-[#f2c46f] opacity-95 max-[768px]:hidden">[{cgt}]</span>

                  <Link
                    to={`/jen?post=${post.id}`}
                    className="text-[var(--jen-orange)] no-underline font-semibold uppercase text-[1.15rem] hover:underline"
                    title={post.title}
                  >
                    {post.title}
                  </Link>

                  <span className="text-white/[0.72] font-jawaese text-[0.85rem] max-[768px]:hidden">
                    — {post.author_handle ?? "Unknown"}
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
