import type { CreatorPlatform, CreatorProfile } from "@/types";

export const PLATFORM_OPTIONS = [
  "Instagram",
  "YouTube",
  "Twitter / X",
  "TikTok",
  "Snapchat",
  "Facebook",
  "LinkedIn",
  "Pinterest",
  "Threads",
  "Twitch",
  "Blog / Website",
  "Other",
] as const;

/** Rough URL patterns used to sanity-check a profile link per platform. */
const LINK_HINTS: Record<string, string> = {
  Instagram: "instagram.com",
  YouTube: "youtube.com",
  "Twitter / X": "twitter.com",
  TikTok: "tiktok.com",
  Snapchat: "snapchat.com",
  Facebook: "facebook.com",
  LinkedIn: "linkedin.com",
  Pinterest: "pinterest.com",
  Threads: "threads.net",
  Twitch: "twitch.tv",
};

export function newPlatform(): CreatorPlatform {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    platform: "",
    handle: "",
    profileLink: "",
    followerCount: "",
  };
}

export function isValidUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const u = new URL(
      value.startsWith("http") ? value : `https://${value}`,
    );
    return !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Returns a human-readable problem with a platform entry, or null if valid. */
export function validatePlatform(p: CreatorPlatform): string | null {
  if (!p.platform.trim()) return "Select a platform";
  if (!p.handle.trim()) return "Enter your handle / username";
  if (!p.profileLink.trim()) return "Enter your profile link";
  if (!isValidUrl(p.profileLink)) return "Profile link is not a valid URL";
  if (!p.followerCount.trim()) return "Enter your follower count";

  const hint = LINK_HINTS[p.platform];
  if (hint && !p.profileLink.toLowerCase().includes(hint)) {
    return `Link doesn't look like a ${p.platform} URL (expected ${hint})`;
  }

  return null;
}

/** Validates the whole list. Returns a map of platform id → error. */
export function validatePlatforms(
  platforms: CreatorPlatform[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  platforms.forEach((p) => {
    const err = validatePlatform(p);
    if (err) errors[p.id] = err;
  });

  // Flag duplicates of the same platform + handle
  const seen = new Map<string, string>();
  platforms.forEach((p) => {
    const key = `${p.platform.toLowerCase()}::${p.handle.trim().toLowerCase()}`;
    if (!p.platform || !p.handle.trim()) return;
    if (seen.has(key)) {
      errors[p.id] = "Duplicate — this platform and handle is already added";
    } else {
      seen.set(key, p.id);
    }
  });

  return errors;
}

/** Parses a follower count like "16K" / "1.2M" / "4,500" into a number. */
export function parseFollowerCount(value: string): number {
  const cleaned = value.trim().toLowerCase().replace(/,/g, "");
  const match = cleaned.match(/^([\d.]+)\s*([km]?)$/);
  if (!match) return 0;

  const n = parseFloat(match[1]);
  if (Number.isNaN(n)) return 0;

  if (match[2] === "k") return Math.round(n * 1_000);
  if (match[2] === "m") return Math.round(n * 1_000_000);
  return Math.round(n);
}

export function totalFollowers(platforms: CreatorPlatform[]): number {
  return platforms.reduce(
    (sum, p) => sum + parseFollowerCount(p.followerCount),
    0,
  );
}

export function formatFollowerCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

/**
 * Reads a creator's platforms, transparently upgrading legacy documents
 * that only have the old single `platform` / `profileLink` fields.
 */
export function getPlatforms(
  profile: Partial<CreatorProfile> | null | undefined,
): CreatorPlatform[] {
  if (!profile) return [];

  if (Array.isArray(profile.platforms) && profile.platforms.length) {
    return profile.platforms;
  }

  // Legacy fallback
  if (profile.platform || profile.profileLink) {
    return [
      {
        id: "legacy",
        platform: profile.platform || "",
        handle: "",
        profileLink: profile.profileLink || "",
        followerCount: profile.followerCount || "",
      },
    ];
  }

  return [];
}

/** Short one-line summary, e.g. "Instagram, YouTube +1 more". */
export function summarisePlatforms(platforms: CreatorPlatform[]): string {
  const names = platforms.map((p) => p.platform).filter(Boolean);
  if (!names.length) return "—";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

export function normaliseLink(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return v.startsWith("http") ? v : `https://${v}`;
}
