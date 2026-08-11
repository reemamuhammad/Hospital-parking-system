import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock,
  Home,
  MapPin,
  Navigation,
  ParkingCircle,
  User,
  Stethoscope,
  Bell,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GarageMap, formatLeft } from "@/components/parking/GarageMap";
import { HospitalSearch } from "@/components/parking/HospitalSearch";
import {
  appointments,
  buildFloors,
  type Hospital,
  type ParkingLevel,
  type Spot,
} from "@/components/parking/data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Hospital Parking — Find Any Hospital Garage Worldwide" },
      {
        name: "description",
        content:
          "Search any hospital worldwide and see its live parking map: available, occupied and reserved spots by floor, plus instant spot booking.",
      },
      { property: "og:title", content: "Smart Hospital Parking" },
      {
        property: "og:description",
        content:
          "Search hospitals worldwide, view their live garage map and book a parking spot in seconds.",
      },
    ],
  }),
  component: Index,
});

type Tab = "home" | "search" | "map";

type Reservation = { id: string; expiresAt: number; bookingId?: string };

const HOLD_OPTIONS = [5, 15, 30, 60] as const;

function Index() {
  const [tab, setTab] = useState<Tab>("home");
  const { user } = useAuth();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [selected, setSelected] = useState<Spot | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [holdMinutes, setHoldMinutes] = useState<number>(30);
  const [now, setNow] = useState(() => Date.now());

  // Default to the first hospital in the directory until the user searches.
  useQuery({
    queryKey: ["default-hospital"],
    enabled: hospital === null,
    queryFn: async () => {
      const { data } = await supabase
        .from("hospitals")
        .select("id, slug, name, city, country, address, garage_name, latitude, longitude")
        .order("name")
        .limit(1)
        .maybeSingle();
      if (data) setHospital(data as Hospital);
      return data ?? null;
    },
  });

  const { data: levels = [] } = useQuery({
    queryKey: ["parking-levels", hospital?.id],
    enabled: !!hospital,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parking_levels")
        .select("id, code, name, note, spot_count, spot_prefix, sort_order")
        .eq("hospital_id", hospital!.id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ParkingLevel[];
    },
  });

  const floors = useMemo(
    () => (hospital ? buildFloors(hospital.slug, levels) : []),
    [hospital, levels],
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Reservations belong to a garage — clear them when switching hospitals.
  useEffect(() => {
    setSelected(null);
    setReservations([]);
  }, [hospital?.id]);

  useEffect(() => {
    const expired = reservations.filter((r) => r.expiresAt <= now);
    if (expired.length === 0) return;
    setReservations((rs) => rs.filter((r) => r.expiresAt > Date.now()));
    for (const r of expired) {
      if (r.bookingId) {
        void supabase.from("bookings").update({ status: "expired" }).eq("id", r.bookingId);
      }
      toast(`Reservation for spot ${r.id} expired`, {
        description: "The hold ran out — the spot is available again.",
      });
    }
  }, [now, reservations]);

  const reservedIds = useMemo(() => reservations.map((r) => r.id), [reservations]);
  const reservedRemaining = useMemo(
    () =>
      Object.fromEntries(
        reservations.map((r) => [r.id, Math.max(0, Math.round((r.expiresAt - now) / 1000))]),
      ),
    [reservations, now],
  );

  const total = floors.reduce((n, f) => n + f.spots.length, 0);
  const free = floors.reduce(
    (n, f) => n + f.spots.filter((s) => !s.occupied && !reservedIds.includes(s.id)).length,
    0,
  );

  const book = async () => {
    if (selected) {
      const id = selected.id;
      const expiresAt = Date.now() + holdMinutes * 60_000;
      setReservations((rs) =>
        rs.some((r) => r.id === id) ? rs : [...rs, { id, expiresAt }],
      );
      toast.success(`Spot ${selected.id} reserved`, {
        description: user
          ? `Held for ${holdMinutes} minutes — saved to your bookings.`
          : `Held for ${holdMinutes} minutes. Sign in to save it to your profile.`,
      });
      setSelected(null);
      if (user) {
        const floor = floors.find((f) => f.spots.some((s) => s.id === id));
        const { data, error } = await supabase
          .from("bookings")
          .insert({
            user_id: user.id,
            spot_id: id,
            floor_id: floor?.id ?? "L1",
            floor_name: floor?.name ?? null,
            hospital_id: hospital?.id ?? null,
            hospital_name: hospital?.name ?? null,
            expires_at: new Date(expiresAt).toISOString(),
          })
          .select("id")
          .single();
        if (!error && data) {
          setReservations((rs) =>
            rs.map((r) => (r.id === id ? { ...r, bookingId: data.id } : r)),
          );
        }
      }
    } else {
      setTab("map");
      toast("Pick a green spot on the map to reserve it.");
    }
  };

  const cancelReservation = (spotId: string) => {
    const existing = reservations.find((r) => r.id === spotId);
    if (existing?.bookingId) {
      void supabase.from("bookings").update({ status: "cancelled" }).eq("id", existing.bookingId);
    }
    setReservations((rs) => rs.filter((r) => r.id !== spotId));
    toast(`Reservation for spot ${spotId} cancelled`, {
      description: "The spot is available again on the map.",
    });
  };

  const openDirections = () => {
    if (!hospital) return;
    const destination =
      hospital.latitude != null && hospital.longitude != null
        ? `${hospital.latitude},${hospital.longitude}`
        : [hospital.garage_name, hospital.name, hospital.address, hospital.city, hospital.country]
            .filter(Boolean)
            .join(", ");
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      destination,
    )}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Toaster />
      <header className="bg-[image:var(--gradient-primary)] px-4 pb-10 pt-6 text-primary-foreground sm:px-8 sm:pb-14">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-foreground/15">
              <ParkingCircle className="size-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold sm:text-2xl">Smart Hospital Parking</h1>
              <p className="truncate text-sm opacity-80">
                {hospital
                  ? `${hospital.name} · ${hospital.garage_name} · ${hospital.city}`
                  : "Search a hospital to get started"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className="grid size-10 place-items-center rounded-full bg-primary-foreground/15">
              <Bell className="size-5" />
            </button>
            <Link
              to={user ? "/profile" : "/auth"}
              className="rounded-full bg-primary-foreground/15 px-4 py-2 text-sm font-medium"
            >
              {user ? "My profile" : "Sign in"}
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-6 grid max-w-5xl grid-cols-3 gap-3">
          <Stat label="Available" value={String(free)} />
          <Stat label="Occupied" value={String(total - free - reservedIds.length)} />
          <Stat label="Reserved" value={String(reservedIds.length)} />
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-5xl space-y-6 px-4 sm:px-8">
        {tab === "search" ? (
          <HospitalSearch
            selected={hospital}
            onSelect={(h) => {
              setHospital(h);
              setTab("map");
              toast.success(`${h.name} selected`, { description: "Showing its live garage map." });
            }}
          />
        ) : (
          <button
            onClick={() => setTab("search")}
            className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-3xl bg-card px-4 py-4 text-left shadow-[var(--shadow-card)]"
          >
            <Search className="size-5 text-muted-foreground" />
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {hospital ? `${hospital.name} — tap to change hospital` : "Search hospitals worldwide"}
            </span>
          </button>
        )}

        {tab !== "search" && (
          <GarageMap
            floors={floors}
            title={hospital ? `${hospital.garage_name} live map` : "Garage live map"}
          selectedSpot={selected}
          onSelectSpot={setSelected}
          reservedIds={reservedIds}
          reservedRemaining={reservedRemaining}
          onCancelReservation={cancelReservation}
          />
        )}

        {tab === "home" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold sm:text-xl">Upcoming appointments</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {appointments.map((a) => (
                <article
                  key={a.id}
                  className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <Stethoscope className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{a.title}</h3>
                      <p className="truncate text-sm text-muted-foreground">
                        {a.department} · {a.doctor}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-4" /> {a.date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4" /> {a.time}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4" /> {a.building}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab !== "search" && (
        <div className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Hold time</span>
            {HOLD_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setHoldMinutes(m)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  holdMinutes === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent",
                )}
              >
                {m} min
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <p className="min-w-0 text-sm text-muted-foreground">
              {selected
                ? `Spot ${selected.id} selected — hold it for ${holdMinutes} minutes.`
                : reservations.length > 0
                  ? `Reserved: ${reservations
                      .map((r) => `${r.id} (${formatLeft((r.expiresAt - now) / 1000)} left)`)
                      .join(", ")}`
                  : "No spot selected yet. Choose a green spot on the map."}
            </p>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {reservations.length > 0 && (
                <Button variant="outline" size="lg" onClick={openDirections}>
                  <MapPin /> Get Directions
                </Button>
              )}
              {reservations.length > 0 && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => cancelReservation(reservations[reservations.length - 1]!.id)}
                >
                  <X /> Cancel reservation
                </Button>
              )}
              <Button variant="hero" size="lg" onClick={() => void book()}>
                <Navigation /> Book a Spot
              </Button>
            </div>
          </div>
        </div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {(
            [
              { id: "home", label: "Home", Icon: Home },
              { id: "search", label: "Search", Icon: Search },
              { id: "map", label: "Map", Icon: MapPin },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                tab === id ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
          <Link
            to={user ? "/profile" : "/auth"}
            className="flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <User className="size-5" />
            Profile
          </Link>
        </div>
      </nav>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-primary-foreground/15 px-3 py-3 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}
