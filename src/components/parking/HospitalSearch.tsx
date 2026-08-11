import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Loader2, MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Hospital } from "./data";

type Props = {
  selected: Hospital | null;
  onSelect: (hospital: Hospital) => void;
};

export function HospitalSearch({ selected, onSelect }: Props) {
  const [term, setTerm] = useState("");

  const { data: hospitals = [], isLoading } = useQuery({
    queryKey: ["hospitals", term],
    queryFn: async () => {
      let query = supabase
        .from("hospitals")
        .select("id, slug, name, city, country, address, garage_name, latitude, longitude")
        .order("name")
        .limit(20);
      const q = term.trim();
      if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,country.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Hospital[];
    },
  });

  const results = useMemo(() => hospitals.slice(0, 8), [hospitals]);

  return (
    <section className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-lg font-semibold sm:text-xl">Find a hospital</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Search any hospital worldwide to open its live parking map.
      </p>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Hospital, city or country…"
          aria-label="Search hospitals"
          className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-11 text-sm outline-none transition-colors focus:border-primary"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {results.map((h) => {
          const active = selected?.id === h.id;
          return (
            <li key={h.id}>
              <button
                onClick={() => onSelect(h)}
                className={cn(
                  "grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-xl",
                    active ? "bg-primary-foreground/20" : "bg-card",
                  )}
                >
                  <Building2 className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{h.name}</span>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 truncate text-xs",
                      active ? "opacity-80" : "text-muted-foreground",
                    )}
                  >
                    <MapPin className="size-3.5 shrink-0" />
                    {h.city}, {h.country} · {h.garage_name}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!isLoading && results.length === 0 && (
          <li className="rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            No hospitals match “{term}”.
          </li>
        )}
      </ul>
    </section>
  );
}