import type { CreatorProfile } from "@/types";
import { getPlatforms } from "./platforms";

export interface CompletionItem {
  key: string;
  label: string;
  weight: number;
  done: boolean;
  /** Where the creator should go to complete this. */
  route: "/verification" | "/settings";
}

export interface CompletionResult {
  percent: number;
  items: CompletionItem[];
  missing: CompletionItem[];
  completed: CompletionItem[];
}

function has(v: unknown): boolean {
  return typeof v === "string" ? v.trim().length > 0 : !!v;
}

/**
 * Weighted profile completion.
 *
 * Verification-critical fields carry the most weight, because they're
 * what actually unlocks earnings. Nice-to-have profile polish is worth
 * less but still moves the needle.
 */
export function calculateCompletion(
  profile: Partial<CreatorProfile> | null | undefined,
): CompletionResult {
  const platforms = getPlatforms(profile);
  const hasValidPlatform = platforms.some(
    (p) => has(p.platform) && has(p.profileLink) && has(p.followerCount),
  );

  const items: CompletionItem[] = [
    {
      key: "fullName",
      label: "Full name",
      weight: 8,
      done: has(profile?.fullName),
      route: "/settings",
    },
    {
      key: "email",
      label: "Email address",
      weight: 5,
      done: has(profile?.email),
      route: "/settings",
    },
    {
      key: "phone",
      label: "Phone number",
      weight: 7,
      done: has(profile?.phone),
      route: "/settings",
    },
    {
      key: "platforms",
      label: "At least one social platform",
      weight: 18,
      done: hasValidPlatform,
      route: "/verification",
    },
    {
      key: "multiPlatform",
      label: "Two or more platforms",
      weight: 6,
      done: platforms.filter((p) => has(p.platform)).length >= 2,
      route: "/verification",
    },
    {
      key: "contentNiche",
      label: "Content niche",
      weight: 8,
      done: has(profile?.contentNiche),
      route: "/verification",
    },
    {
      key: "idProofType",
      label: "ID proof type",
      weight: 8,
      done: has(profile?.idProofType),
      route: "/verification",
    },
    {
      key: "idProofNumber",
      label: "ID proof number",
      weight: 8,
      done: has(profile?.idProofNumber),
      route: "/verification",
    },
    {
      key: "idProofFileUrl",
      label: "ID document uploaded",
      weight: 12,
      done: has(profile?.idProofFileUrl),
      route: "/verification",
    },
    {
      key: "bio",
      label: "Bio",
      weight: 6,
      done: has(profile?.bio),
      route: "/settings",
    },
    {
      key: "city",
      label: "City",
      weight: 4,
      done: has(profile?.city),
      route: "/settings",
    },
    {
      key: "state",
      label: "State",
      weight: 4,
      done: has(profile?.state),
      route: "/settings",
    },
    {
      key: "verified",
      label: "Account verified by Drippr",
      weight: 6,
      done: profile?.verificationStatus === "approved",
      route: "/verification",
    },
  ];

  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const earned = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0);
  const percent = Math.round((earned / totalWeight) * 100);

  return {
    percent,
    items,
    missing: items.filter((i) => !i.done),
    completed: items.filter((i) => i.done),
  };
}

/** Colour band for the progress ring. */
export function completionColor(percent: number): string {
  if (percent >= 90) return "#10b981"; // emerald
  if (percent >= 60) return "#3b82f6"; // blue
  if (percent >= 30) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

export function completionLabel(percent: number): string {
  if (percent >= 100) return "Complete";
  if (percent >= 90) return "Almost there";
  if (percent >= 60) return "Good progress";
  if (percent >= 30) return "Getting started";
  return "Just started";
}
