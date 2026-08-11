export type Spot = {
  id: string;
  occupied: boolean;
  type: "standard" | "accessible" | "ev";
};

export type Floor = {
  id: string;
  name: string;
  note: string;
  spots: Spot[];
};

// Deterministic pseudo-random layout so SSR and client render identically.
function buildSpots(floorIndex: number, count: number): Spot[] {
  return Array.from({ length: count }, (_, i) => {
    const seed = (floorIndex * 37 + i * 17) % 100;
    return {
      id: `${String.fromCharCode(65 + floorIndex)}${String(i + 1).padStart(2, "0")}`,
      occupied: seed % 3 !== 0,
      type: i % 16 === 0 ? "accessible" : i % 11 === 0 ? "ev" : "standard",
    };
  });
}

export const floors: Floor[] = [
  { id: "L1", name: "Level 1", note: "Emergency & Main Entrance", spots: buildSpots(0, 40) },
  { id: "L2", name: "Level 2", note: "Outpatient Clinics", spots: buildSpots(1, 40) },
  { id: "L3", name: "Level 3", note: "Visitors & Long Stay", spots: buildSpots(2, 40) },
];

export type Hospital = {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  address: string | null;
  garage_name: string;
  latitude: number | null;
  longitude: number | null;
};

export type ParkingLevel = {
  id: string;
  code: string;
  name: string;
  note: string;
  spot_count: number;
  spot_prefix: string;
  sort_order: number;
};

function hashString(value: string) {
  let h = 7;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) % 9973;
  return h;
}

/** Deterministic garage layout for a hospital, derived from its configured levels. */
export function buildFloors(hospitalSlug: string, levels: ParkingLevel[]): Floor[] {
  const base = hashString(hospitalSlug);
  return levels.map((level, levelIndex) => ({
    id: level.code,
    name: level.name,
    note: level.note,
    spots: Array.from({ length: level.spot_count }, (_, i) => {
      const seed = (base + levelIndex * 37 + i * 17) % 100;
      return {
        id: `${level.spot_prefix}${String(i + 1).padStart(2, "0")}`,
        occupied: seed % 3 !== 0,
        type: (i % 16 === 0 ? "accessible" : i % 11 === 0 ? "ev" : "standard") as Spot["type"],
      };
    }),
  }));
}

export type Appointment = {
  id: string;
  title: string;
  department: string;
  doctor: string;
  date: string;
  time: string;
  building: string;
};

export const appointments: Appointment[] = [
  {
    id: "1",
    title: "Cardiology Follow-up",
    department: "Cardiology",
    doctor: "Dr. Salma Haddad",
    date: "Mon, 10 Aug",
    time: "09:30",
    building: "Tower B · Level 3",
  },
  {
    id: "2",
    title: "Blood Work",
    department: "Laboratory",
    doctor: "Walk-in",
    date: "Thu, 13 Aug",
    time: "07:45",
    building: "Main Wing · Level 1",
  },
  {
    id: "3",
    title: "Physiotherapy Session",
    department: "Rehabilitation",
    doctor: "Dr. Omar Nasser",
    date: "Fri, 21 Aug",
    time: "16:15",
    building: "Annex · Level 2",
  },
];