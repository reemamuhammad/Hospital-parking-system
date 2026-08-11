import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Spot } from "./data";
import { formatLeft } from "./format";

const SPOT_W = 54;
const SPOT_H = 96;
const GAP = 8;
const AISLE = 78;
const PER_ROW = 10;
const PAD = 28;
const HEADER = 44;

type Placed = { spot: Spot; x: number; y: number; flip: boolean };

/** Two rows of bays face each other across a driving lane, repeated down the deck. */
function layout(spots: Spot[]) {
  const placed: Placed[] = [];
  const lanes: { y: number; height: number }[] = [];
  let y = HEADER;

  for (let i = 0; i < spots.length; i += PER_ROW * 2) {
    const top = spots.slice(i, i + PER_ROW);
    const bottom = spots.slice(i + PER_ROW, i + PER_ROW * 2);

    top.forEach((spot, c) => {
      placed.push({ spot, x: PAD + c * (SPOT_W + GAP), y, flip: false });
    });
    if (bottom.length > 0) {
      lanes.push({ y: y + SPOT_H, height: AISLE });
      bottom.forEach((spot, c) => {
        placed.push({
          spot,
          x: PAD + c * (SPOT_W + GAP),
          y: y + SPOT_H + AISLE,
          flip: true,
        });
      });
      y += SPOT_H * 2 + AISLE + GAP * 3;
    } else {
      y += SPOT_H + GAP * 3;
    }
  }

  const width = PAD * 2 + PER_ROW * SPOT_W + (PER_ROW - 1) * GAP;
  return { placed, lanes, width, height: y + PAD };
}

type Props = {
  spots: Spot[];
  selectedId?: string | null;
  reservedIds: string[];
  reservedRemaining: Record<string, number>;
  onSelect: (spot: Spot) => void;
  onCancel: (spotId: string) => void;
  floorName: string;
};

export function GarageSvg({
  spots,
  selectedId,
  reservedIds,
  reservedRemaining,
  onSelect,
  onCancel,
  floorName,
}: Props) {
  const { placed, lanes, width, height } = useMemo(() => layout(spots), [spots]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label={`${floorName} parking layout`}
      className="w-full select-none"
    >
      {/* deck surface */}
      <rect
        x="4"
        y="4"
        width={width - 8}
        height={height - 8}
        rx="20"
        className="fill-muted stroke-border"
        strokeWidth="2"
      />

      {/* entrance marker */}
      <g className="text-primary">
        <rect x={PAD} y="14" width="120" height="22" rx="11" fill="currentColor" opacity="0.12" />
        <text
          x={PAD + 60}
          y="29"
          textAnchor="middle"
          fill="currentColor"
          className="text-[13px] font-semibold"
        >
          Entrance
        </text>
        <path
          d={`M ${PAD + 132} 25 h 26 m -8 -6 l 8 6 l -8 6`}
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* driving lanes */}
      {lanes.map((lane, i) => (
        <g key={i}>
          <rect
            x={PAD - 10}
            y={lane.y}
            width={width - (PAD - 10) * 2}
            height={lane.height}
            className="fill-background"
            opacity="0.6"
          />
          <line
            x1={PAD}
            y1={lane.y + lane.height / 2}
            x2={width - PAD}
            y2={lane.y + lane.height / 2}
            className="stroke-border"
            strokeWidth="3"
            strokeDasharray="18 14"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* parking bays */}
      {placed.map(({ spot, x, y, flip }) => {
        const reserved = reservedIds.includes(spot.id);
        const selected = selectedId === spot.id;
        const status = spot.occupied ? "occupied" : reserved ? "reserved" : "available";
        const left = reservedRemaining[spot.id];

        return (
          <g
            key={spot.id}
            role="button"
            tabIndex={spot.occupied ? -1 : 0}
            aria-label={
              reserved
                ? `Spot ${spot.id} reserved — activate to cancel`
                : `Spot ${spot.id} ${status}`
            }
            onClick={() => {
              if (spot.occupied) return;
              if (reserved) onCancel(spot.id);
              else onSelect(spot);
            }}
            onKeyDown={(e) => {
              if (spot.occupied) return;
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              if (reserved) onCancel(spot.id);
              else onSelect(spot);
            }}
            className={cn(
              "outline-none transition-opacity",
              spot.occupied ? "cursor-not-allowed" : "cursor-pointer hover:opacity-85",
            )}
          >
            {/* bay markings */}
            <path
              d={
                flip
                  ? `M ${x} ${y + SPOT_H} V ${y} M ${x + SPOT_W} ${y + SPOT_H} V ${y}`
                  : `M ${x} ${y} V ${y + SPOT_H} M ${x + SPOT_W} ${y} V ${y + SPOT_H}`
              }
              className="stroke-border"
              strokeWidth="2"
              fill="none"
            />
            <rect
              x={x + 3}
              y={y + 4}
              width={SPOT_W - 6}
              height={SPOT_H - 8}
              rx="8"
              className={cn(
                status === "occupied"
                  ? "fill-occupied"
                  : status === "reserved"
                    ? "fill-reserved"
                    : "fill-available",
              )}
              opacity={status === "occupied" ? 0.22 : 1}
            />
            {selected && (
              <rect
                x={x + 1}
                y={y + 2}
                width={SPOT_W - 2}
                height={SPOT_H - 4}
                rx="10"
                fill="none"
                className="stroke-primary"
                strokeWidth="4"
              />
            )}
            <text
              x={x + SPOT_W / 2}
              y={y + SPOT_H / 2 + 2}
              textAnchor="middle"
              className={cn(
                "text-[15px] font-bold",
                status === "occupied" ? "fill-occupied" : "fill-white",
              )}
            >
              {spot.id}
            </text>
            {status !== "occupied" && spot.type !== "standard" && (
              <text
                x={x + SPOT_W / 2}
                y={y + 24}
                textAnchor="middle"
                className="fill-white text-[12px] font-semibold"
              >
                {spot.type === "ev" ? "EV" : "♿"}
              </text>
            )}
            {reserved && left != null && (
              <text
                x={x + SPOT_W / 2}
                y={y + SPOT_H - 14}
                textAnchor="middle"
                className="fill-white text-[12px] font-semibold tabular-nums"
              >
                {formatLeft(left)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
