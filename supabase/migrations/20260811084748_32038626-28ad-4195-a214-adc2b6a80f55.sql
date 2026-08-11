UPDATE public.hospitals SET latitude = v.lat, longitude = v.lng FROM (VALUES
 ('mayo-clinic-rochester', 44.0225, -92.4669),
 ('cleveland-clinic', 41.5030, -81.6212),
 ('johns-hopkins-hospital', 39.2969, -76.5929),
 ('st-thomas-hospital', 51.4980, -0.1187),
 ('charite-berlin', 52.5265, 13.3765),
 ('singapore-general-hospital', 1.2795, 103.8350),
 ('toronto-general-hospital', 43.6580, -79.3880),
 ('apollo-hospitals-chennai', 13.0640, 80.2510),
 ('royal-melbourne-hospital', -37.7990, 144.9560),
 ('al-noor-medical-center', 24.7136, 46.6753)
) AS v(slug, lat, lng)
WHERE public.hospitals.slug = v.slug;