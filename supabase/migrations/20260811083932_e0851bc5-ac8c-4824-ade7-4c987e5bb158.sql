CREATE TABLE public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  address text,
  garage_name text NOT NULL DEFAULT 'Main Garage',
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hospitals TO anon;
GRANT SELECT ON public.hospitals TO authenticated;
GRANT ALL ON public.hospitals TO service_role;

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospitals are publicly readable"
  ON public.hospitals FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.parking_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  note text NOT NULL DEFAULT '',
  spot_count integer NOT NULL DEFAULT 40,
  spot_prefix text NOT NULL DEFAULT 'A',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, code)
);

GRANT SELECT ON public.parking_levels TO anon;
GRANT SELECT ON public.parking_levels TO authenticated;
GRANT ALL ON public.parking_levels TO service_role;

ALTER TABLE public.parking_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parking levels are publicly readable"
  ON public.parking_levels FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX idx_parking_levels_hospital ON public.parking_levels(hospital_id, sort_order);
CREATE INDEX idx_hospitals_name ON public.hospitals(lower(name));

CREATE TRIGGER update_hospitals_updated_at
  BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parking_levels_updated_at
  BEFORE UPDATE ON public.parking_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bookings
  ADD COLUMN hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  ADD COLUMN hospital_name text;

INSERT INTO public.hospitals (slug, name, city, country, address, garage_name) VALUES
  ('al-noor-medical-center', 'Al Noor Medical Center', 'Riyadh', 'Saudi Arabia', 'King Fahd Rd', 'Garage A'),
  ('mayo-clinic-rochester', 'Mayo Clinic', 'Rochester, MN', 'United States', '200 First St SW', 'Damon Parking Ramp'),
  ('cleveland-clinic', 'Cleveland Clinic', 'Cleveland, OH', 'United States', '9500 Euclid Ave', 'Main Campus Garage'),
  ('johns-hopkins-hospital', 'Johns Hopkins Hospital', 'Baltimore, MD', 'United States', '1800 Orleans St', 'Orleans Street Garage'),
  ('st-thomas-hospital', 'St Thomas Hospital', 'London', 'United Kingdom', 'Westminster Bridge Rd', 'South Wing Car Park'),
  ('charite-berlin', 'Charité Universitätsmedizin', 'Berlin', 'Germany', 'Charitéplatz 1', 'Mitte Parkhaus'),
  ('singapore-general-hospital', 'Singapore General Hospital', 'Singapore', 'Singapore', 'Outram Rd', 'Block 3 Carpark'),
  ('toronto-general-hospital', 'Toronto General Hospital', 'Toronto', 'Canada', '200 Elizabeth St', 'Elizabeth Street Garage'),
  ('apollo-hospitals-chennai', 'Apollo Hospitals', 'Chennai', 'India', '21 Greams Lane', 'Greams Road Parking'),
  ('royal-melbourne-hospital', 'Royal Melbourne Hospital', 'Melbourne', 'Australia', '300 Grattan St', 'Grattan Street Garage');

INSERT INTO public.parking_levels (hospital_id, code, name, note, spot_count, spot_prefix, sort_order)
SELECT h.id, l.code, l.name, l.note, l.spot_count, l.spot_prefix, l.sort_order
FROM public.hospitals h
CROSS JOIN (VALUES
  ('L1', 'Level 1', 'Emergency & Main Entrance', 40, 'A', 0),
  ('L2', 'Level 2', 'Outpatient Clinics', 40, 'B', 1),
  ('L3', 'Level 3', 'Visitors & Long Stay', 40, 'C', 2)
) AS l(code, name, note, spot_count, spot_prefix, sort_order);