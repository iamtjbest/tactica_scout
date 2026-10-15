"use client";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getMe, updateFollowedTeams } from "@/lib/api";
import clsx from "clsx";
import { useRouter } from "next/navigation";

export default function FollowButton({
  entityType,
  entityId,
  entityName,
  className
}: {
  entityType: "team" | "league" | "player";
  entityId: number;
  entityName: string;
  className?: string;
}) {
  const [followed, setFollowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const tokenStr = `${entityType}:${entityId}:${entityName}`;

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage.getItem("scout_token")) {
      setLoading(false);
      return;
    }
    getMe()
      .then((data) => {
        // Handle both old plain string names and new token format
        const isFollowed = data.user.followed_teams.some((t: string) => t === tokenStr || t === entityName);
        setFollowed(isFollowed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tokenStr, entityName]);

  const toggleFollow = async () => {
    if (!window.localStorage.getItem("scout_token")) {
      router.push("/signin");
      return;
    }
    
    setLoading(true);
    try {
      const data = await getMe();
      let newFollows = [...data.user.followed_teams];
      
      const exists = newFollows.some((t: string) => t === tokenStr || t === entityName);
      if (exists) {
        newFollows = newFollows.filter((t: string) => t !== tokenStr && t !== entityName);
        setFollowed(false);
      } else {
        newFollows.push(tokenStr);
        setFollowed(true);
      }
      
      await updateFollowedTeams(newFollows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <button className={clsx("flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold opacity-50 cursor-not-allowed", className)}>
      <Star size={16} className="text-mt" /> Follow
    </button>
  );

  return (
    <button 
      onClick={toggleFollow}
      className={clsx(
        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-lg",
        followed 
          ? "bg-volt2/20 border border-volt2 text-volt2 hover:bg-volt2/30" 
          : "bg-sur hover:bg-sur2 border border-volt2/30 hover:border-volt2 text-white hover:shadow-volt2/20 group",
        className
      )}
    >
      <Star size={16} className={clsx(followed ? "fill-volt2" : "text-volt2 group-hover:fill-volt2 transition-colors")} />
      {followed ? "Following" : "Follow"}
    </button>
  );
}
