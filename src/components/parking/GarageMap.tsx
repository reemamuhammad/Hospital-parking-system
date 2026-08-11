import { useEffect, useMemo, useState } from "react";
import { Accessibility, Clock, MapPin, Plug, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { floors as defaultFloors, type Floor, type Spot } from "./data";
import { GarageSvg } from "./GarageSvg";
import { formatLeft } from "./format";

export { formatLeft };

/** Deterministic rough estimate (in seconds) until an occupied spot becomes free. */
function estimateAvailability(spot: Spot, floorId: string): number {
  let h = 0;
  const key = `${floorId}:${spot.id}`;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 9973;
  // Between 5 and 90 minutes.
  return (5 + (h % 86)) * 60;
}

type Props = {
  selectedSpot: Spot | null;
  onSelectSpot: (spot: Spot | null) => void;
  reservedIds?: string[];
  onCancelReservation?: (spotId: string) => void;
  /** Seconds left per reserved spot id */
  reservedRemaining?: Record<string, number>;
  /** Garage layout to render; defaults to the built-in demo garage. */
  floors?: Floor[];
  /** Optional subtitle, e.g. the hospital + garage name. */
  title?: string;
};

type PanelProps = {
  spot: Spot;
  floor: Floor;
  reservedRemaining: Record<string, number>;
  reservedIds: string[];
};

function SpotDetailPanel({ spot, floor, reservedRemaining, reservedIds }: PanelProps) {
  const reserved = reservedIds.includes(spot.id);
  const status = spot.occupied ? "occupied" : reserved ? "reserved" : "available";
  const availabilitySeconds =
    status === "occupied"
      ? estimateAvailability(spot, floor.id)
      : status === "reserved"
        ? reservedRemaining[spot.id] ?? 0
        : 0;

  const statusBadge =
    status === "available"
      ? "bg-available/15 text-available"
      : status === "reserved"
        ? "bg-reserved/15 text-reserved"
        : "bg-occupied/15 text-occupied";

  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <aside className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] lg:sticky lg:top-4 lg:self-start">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Info className="size-4 text-primary" />
        Spot details
      </h3>

      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Bay</span>
          <span className="text-lg font-bold">{spot.id}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Floor</span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <MapPin className="size-4 text-muted-foreground" />
            {floor.name}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", statusBadge)}>
            {statusLabel}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Type</span>
          <span className="flex items-center gap-1.5 text-sm font-medium capitalize">
            {spot.type === "accessible" && <Accessibility className="size-4" />}
            {spot.type === "ev" && <Plug className="size-4" />}
            {spot.type === "standard" ? "Standard" : spot.type === "accessible" ? "Accessible" : "EV charging"}
          </span>
        </div>

        <div className="rounded-xl bg-muted/60 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4 text-primary" />
            {status === "available" ? (
              <span>Available now</span>
            ) : status === "reserved" ? (
              <span>Reserved — {formatLeft(availabilitySeconds)} remaining</span>
            ) : (
              <span>Estimated free in {formatLeft(availabilitySeconds)}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {status === "occupied"
              ? "Based on typical turnover for this bay."
              : status === "reserved"
                ? "The spot will become available when the hold expires."
                : "Tap the map to reserve this spot."}
          </p>
        </div>
      </div>
    </aside>
  );
}

export function GarageMap({
  selectedSpot,
  onSelectSpot,
  reservedIds = [],
  onCancelReservation,
  reservedRemaining = {},
  floors = defaultFloors,
  title,
}: Props) {
  const [activeFloor, setActiveFloor] = useState(floors[0]?.id ?? "");
  const floor = useMemo(
    () => floors.find((f) => f.id === activeFloor) ?? floors[0],
    [floors, activeFloor],
  );

  useEffect(() => {
    if (floors.length > 0 && !floors.some((f) => f.id === activeFloor)) {
      setActiveFloor(floors[0]!.id);
      onSelectSpot(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors]);

  if (!floor) {
    return (
      <section className="rounded-3xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
        No parking levels published for this hospital yet.
      </section>
    );
  }

  const free = floor.spots.filter((s) => !s.occupied && !reservedIds.includes(s.id)).length;

  return (
    <section className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold sm:text-xl">{title ?? "Garage live map"}</h2>
          <p className="truncate text-sm text-muted-foreground">{floor.note}</p>
        </div>
        <span className="shrink-0 rounded-full bg-available/15 px-3 py-1 text-sm font-medium text-available">
          {free} free
        </span>
      </header>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {floors.map((f) => {
          const active = f.id === activeFloor;
          return (
            <button
              key={f.id}
              onClick={() => {
                setActiveFloor(f.id);
                onSelectSpot(null);
              }}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              )}
            >
              {f.name}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-border bg-muted/60 p-3 sm:p-5">
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <GarageSvg
                spots={floor.spots}
                floorName={floor.name}
                selectedId={selectedSpot?.id ?? null}
                reservedIds={reservedIds}
                reservedRemaining={reservedRemaining}
                onSelect={(spot) => onSelectSpot(selectedSpot?.id === spot.id ? null : spot)}
                onCancel={(id) => onCancelReservation?.(id)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="size-3 rounded bg-available" /> Available
            </span>
            <span className="flex items-center gap-2">
              <span className="size-3 rounded bg-occupied/30" /> Occupied
            </span>
            <span className="flex items-center gap-2">
              <span className="size-3 rounded bg-reserved" /> Reserved (auto-expires)
            </span>
            <span className="flex items-center gap-2">
              <Accessibility className="size-3.5" /> Accessible
            </span>
            <span className="flex items-center gap-2">
              <Plug className="size-3.5" /> EV charging
            </span>
          </div>
        </div>

        {selectedSpot && (
          <SpotDetailPanel
            spot={selectedSpot}
            floor={floor}
            reservedIds={reservedIds}
            reservedRemaining={reservedRemaining}
          />
        )}
      </div>
    </section>
  );
}