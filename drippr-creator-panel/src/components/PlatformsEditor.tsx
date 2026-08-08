import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PLATFORM_OPTIONS,
  newPlatform,
  formatFollowerCount,
  totalFollowers,
} from "@/lib/platforms";
import {
  Plus,
  Trash2,
  AlertCircle,
  Users,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import type { CreatorPlatform } from "@/types";

interface Props {
  platforms: CreatorPlatform[];
  onChange: (platforms: CreatorPlatform[]) => void;
  /** platform.id → error message */
  errors?: Record<string, string>;
  disabled?: boolean;
  /** Show admin-side verified badges. */
  showVerifiedBadges?: boolean;
}

export default function PlatformsEditor({
  platforms,
  onChange,
  errors = {},
  disabled = false,
  showVerifiedBadges = false,
}: Props) {
  function update(id: string, patch: Partial<CreatorPlatform>) {
    onChange(platforms.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function remove(id: string) {
    onChange(platforms.filter((p) => p.id !== id));
  }

  function add() {
    onChange([...platforms, newPlatform()]);
  }

  const total = totalFollowers(platforms);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label className="text-base font-semibold">Social Platforms</Label>
          <p className="text-sm text-gray-500">
            Add every platform where you create content. At least one is
            required.
          </p>
        </div>
        {total > 0 && (
          <Badge variant="secondary" className="gap-1.5">
            <Users className="h-3 w-3" />
            {formatFollowerCount(total)} total reach
          </Badge>
        )}
      </div>

      {platforms.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-6 text-center">
          <p className="text-sm text-gray-500">
            No platforms added yet.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            disabled={disabled}
            className="mt-3"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add your first platform
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {platforms.map((p, index) => {
          const err = errors[p.id];
          return (
            <div
              key={p.id}
              className={`rounded-lg border p-4 ${
                err ? "border-red-300 bg-red-50/40" : "bg-white"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">
                    {p.platform || "New platform"}
                  </span>
                  {showVerifiedBadges && p.verified && (
                    <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {p.profileLink && (
                    <a
                      href={p.profileLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                      title="Open profile"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(p.id)}
                    disabled={disabled}
                    className="h-8 w-8 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Remove platform"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Platform *</Label>
                  <Select
                    value={p.platform}
                    onValueChange={(v) => update(p.id, { platform: v })}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORM_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Handle / Username *</Label>
                  <Input
                    value={p.handle}
                    onChange={(e) => update(p.id, { handle: e.target.value })}
                    placeholder="@yourhandle"
                    disabled={disabled}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Profile Link *</Label>
                  <Input
                    value={p.profileLink}
                    onChange={(e) =>
                      update(p.id, { profileLink: e.target.value })
                    }
                    placeholder="https://instagram.com/yourhandle"
                    disabled={disabled}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Follower Count *</Label>
                  <Input
                    value={p.followerCount}
                    onChange={(e) =>
                      update(p.id, { followerCount: e.target.value })
                    }
                    placeholder="e.g. 16K, 1.2M"
                    disabled={disabled}
                  />
                </div>
              </div>

              {err && (
                <p className="mt-2.5 flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {err}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {platforms.length > 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={disabled}
          className="w-full border-dashed"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add another platform
        </Button>
      )}
    </div>
  );
}

/** Read-only list used on admin screens and confirmation views. */
export function PlatformsList({
  platforms,
  compact = false,
}: {
  platforms: CreatorPlatform[];
  compact?: boolean;
}) {
  if (!platforms.length) {
    return <p className="text-sm text-gray-400">No platforms added</p>;
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      {platforms.map((p) => (
        <div
          key={p.id}
          className={
            compact
              ? "flex items-center gap-2 text-sm"
              : "rounded-lg border p-3"
          }
        >
          {compact ? (
            <>
              <span className="font-medium">{p.platform}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">{p.handle}</span>
              <span className="ml-auto text-gray-500">{p.followerCount}</span>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.platform}</span>
                  {p.verified && (
                    <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {p.followerCount || "—"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-600">{p.handle}</p>
              {p.profileLink && (
                <a
                  href={p.profileLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 break-all text-sm text-blue-600 hover:underline"
                >
                  {p.profileLink}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
