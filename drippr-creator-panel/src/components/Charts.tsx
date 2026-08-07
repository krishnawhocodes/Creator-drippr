/**
 * Dependency-free SVG charts. Keeps the bundle small and avoids
 * pulling in a charting library.
 */

interface Point {
  label: string;
  value: number;
}

/** Smooth area + line chart */
export function AreaChart({
  data,
  height = 220,
  color = "#18181b",
  valuePrefix = "",
}: {
  data: Point[];
  height?: number;
  color?: string;
  valuePrefix?: string;
}) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  const W = 600;
  const H = height;
  const padX = 8;
  const padTop = 16;
  const padBottom = 28;

  const max = Math.max(...data.map((d) => d.value), 1);
  const innerH = H - padTop - padBottom;
  const stepX =
    data.length > 1 ? (W - padX * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padTop + innerH - (d.value / max) * innerH;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
      padTop + innerH
    ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + innerH).toFixed(
      1,
    )} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {gridLines.map((g) => {
        const y = padTop + innerH * g;
        return (
          <line
            key={g}
            x1={padX}
            y1={y}
            x2={W - padX}
            y2={y}
            stroke="#e5e7eb"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        );
      })}

      <path d={areaPath} fill="url(#areaFill)" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
          <title>{`${p.label}: ${valuePrefix}${p.value.toLocaleString("en-IN")}`}</title>
        </g>
      ))}

      {/* X labels — show first, middle, last to avoid crowding */}
      {points.map((p, i) => {
        const show =
          i === 0 ||
          i === points.length - 1 ||
          i === Math.floor(points.length / 2);
        if (!show) return null;
        return (
          <text
            key={`lbl-${i}`}
            x={p.x}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            fontSize="11"
            fill="#9ca3af"
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

/** Simple vertical bar chart */
export function BarChart({
  data,
  height = 220,
  color = "#18181b",
  valuePrefix = "",
}: {
  data: Point[];
  height?: number;
  color?: string;
  valuePrefix?: string;
}) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t transition-all duration-500"
                style={{
                  height: `${Math.max(pct, 2)}%`,
                  backgroundColor: color,
                  opacity: 0.85,
                }}
                title={`${d.label}: ${valuePrefix}${d.value.toLocaleString("en-IN")}`}
              />
            </div>
            <span className="truncate text-[10px] text-gray-400">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Donut chart for status breakdowns */
export function DonutChart({
  segments,
  size = 160,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} className="flex-shrink-0">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={thickness}
        />
        {total > 0 &&
          segments.map((seg, i) => {
            const frac = seg.value / total;
            const dash = frac * circumference;
            const el = (
              <circle
                key={i}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${c} ${c})`}
                strokeLinecap="butt"
              >
                <title>{`${seg.label}: ${seg.value}`}</title>
              </circle>
            );
            offset += dash;
            return el;
          })}
        {(centerValue !== undefined || centerLabel) && (
          <>
            <text
              x={c}
              y={c - 2}
              textAnchor="middle"
              fontSize="24"
              fontWeight="700"
              fill="#18181b"
            >
              {centerValue}
            </text>
            <text
              x={c}
              y={c + 16}
              textAnchor="middle"
              fontSize="11"
              fill="#9ca3af"
            >
              {centerLabel}
            </text>
          </>
        )}
      </svg>

      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-gray-600">{seg.label}</span>
            <span className="ml-auto font-semibold text-gray-900">
              {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
