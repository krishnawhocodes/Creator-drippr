import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { completionColor } from "@/lib/profileCompletion";

interface Props {
  /** 0–100 */
  percent: number;
  initials: string;
  imageUrl?: string;
  /** Outer diameter in px. */
  size?: number;
  thickness?: number;
  /** Show the percentage in a small badge at the bottom-right. */
  showBadge?: boolean;
  className?: string;
}

/**
 * Avatar wrapped in a circular progress ring showing profile completion.
 */
export default function AvatarRing({
  percent,
  initials,
  imageUrl,
  size = 40,
  thickness = 3,
  showBadge = false,
  className = "",
}: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (clamped / 100) * circumference;
  const color = completionColor(clamped);

  // Leave room for the ring so the avatar doesn't touch it
  const avatarSize = size - thickness * 2 - 4;

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={`Profile ${clamped}% complete`}
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-gray-200"
        />
        {/* Progress */}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
      </svg>

      <div
        className="absolute"
        style={{
          top: thickness + 2,
          left: thickness + 2,
          width: avatarSize,
          height: avatarSize,
        }}
      >
        <Avatar style={{ width: avatarSize, height: avatarSize }}>
          {imageUrl && <AvatarImage src={imageUrl} alt={initials} />}
          <AvatarFallback
            className="bg-zinc-900 text-white"
            style={{ fontSize: Math.max(10, avatarSize * 0.36) }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>

      {showBadge && (
        <span
          className="absolute -bottom-1 -right-1 rounded-full border-2 border-white px-1 text-[9px] font-bold leading-tight text-white"
          style={{ backgroundColor: color }}
        >
          {clamped}
        </span>
      )}
    </div>
  );
}

/**
 * Larger standalone progress ring with the percentage in the middle.
 * Used on the dashboard completion card.
 */
export function CompletionRing({
  percent,
  size = 120,
  thickness = 10,
}: {
  percent: number;
  size?: number;
  thickness?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (clamped / 100) * circumference;
  const color = completionColor(clamped);

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="#f3f4f6"
        strokeWidth={thickness}
      />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference - dash}`}
        transform={`rotate(-90 ${c} ${c})`}
        style={{ transition: "stroke-dasharray 600ms ease" }}
      />
      <text
        x={c}
        y={c - 2}
        textAnchor="middle"
        fontSize={size * 0.24}
        fontWeight="700"
        fill="#18181b"
      >
        {clamped}%
      </text>
      <text
        x={c}
        y={c + size * 0.15}
        textAnchor="middle"
        fontSize={size * 0.09}
        fill="#9ca3af"
      >
        complete
      </text>
    </svg>
  );
}
