import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Car, Clock, LogOut, MailCheck, MapPin, ShieldCheck, User } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Smart Hospital Parking" },
      {
        name: "description",
        content: "Manage your contact and vehicle details and review your parking bookings.",
      },
      { property: "og:title", content: "Your profile — Smart Hospital Parking" },
      {
        property: "og:description",
        content: "Personal details, vehicle information and your hospital parking bookings.",
      },
    ],
  }),
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z.string().trim().max(100).nullable(),
  phone: z.string().trim().max(30).nullable(),
  vehicle_plate: z.string().trim().max(20).nullable(),
  vehicle_model: z.string().trim().max(60).nullable(),
});

type ProfileForm = z.infer<typeof profileSchema>;

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfileForm>({
    full_name: "",
    phone: "",
    vehicle_plate: "",
    vehicle_model: "",
  });
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  const { data: userData } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, vehicle_plate, vehicle_model")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, spot_id, floor_name, status, reserved_at, expires_at")
        .order("reserved_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        vehicle_plate: profile.vehicle_plate ?? "",
        vehicle_model: profile.vehicle_model ?? "",
      });
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    const userId = userData?.id;
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...parsed.data }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const verified = Boolean(userData?.email_confirmed_at);

  const resendVerification = async () => {
    if (!userData?.email) return;
    setSendingVerification(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: userData.email,
      options: { emailRedirectTo: window.location.origin },
    });
    setSendingVerification(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Verification email sent");
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <Toaster />
      <header className="bg-[image:var(--gradient-primary)] px-4 pb-12 pt-6 text-primary-foreground sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-sm opacity-90 hover:opacity-100">
            <ArrowLeft className="size-4" /> Garage map
          </Link>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut /> Sign out
          </Button>
        </div>
        <div className="mx-auto mt-6 flex max-w-3xl items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary-foreground/15">
            <User className="size-7" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">
              {form.full_name || "Your profile"}
            </h1>
            <p className="truncate text-sm opacity-80">{userData?.email}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-3xl space-y-6 px-4 sm:px-8">
        <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={
                  verified
                    ? "grid size-10 place-items-center rounded-2xl bg-available/15 text-available"
                    : "grid size-10 place-items-center rounded-2xl bg-muted text-muted-foreground"
                }
              >
                {verified ? <ShieldCheck className="size-5" /> : <AlertCircle className="size-5" />}
              </span>
              <div>
                <h2 className="text-base font-semibold">
                  {verified ? "Email verified" : "Email not verified"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {verified
                    ? `${userData?.email} is confirmed.`
                    : "Confirm your email to secure your account and bookings."}
                </p>
              </div>
            </div>
            {!verified && (
              <Button variant="secondary" onClick={resendVerification} disabled={sendingVerification}>
                <MailCheck /> {sendingVerification ? "Sending…" : "Resend verification email"}
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold">Personal information</h2>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={save}>
            <Field
              id="full_name"
              label="Full name"
              value={form.full_name ?? ""}
              max={100}
              onChange={(v) => setForm((f) => ({ ...f, full_name: v }))}
            />
            <Field
              id="phone"
              label="Phone"
              value={form.phone ?? ""}
              max={30}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            />
            <Field
              id="vehicle_plate"
              label="Vehicle plate"
              value={form.vehicle_plate ?? ""}
              max={20}
              onChange={(v) => setForm((f) => ({ ...f, vehicle_plate: v }))}
            />
            <Field
              id="vehicle_model"
              label="Vehicle model"
              value={form.vehicle_model ?? ""}
              max={60}
              onChange={(v) => setForm((f) => ({ ...f, vehicle_model: v }))}
            />
            <div className="sm:col-span-2">
              <Button type="submit" variant="hero" size="lg" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your parking bookings</h2>
          {!bookings || bookings.length === 0 ? (
            <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
              No bookings yet. Reserve a spot from the garage map and it will appear here.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {bookings.map((b) => (
                <li key={b.id} className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-semibold">
                      <Car className="size-4" /> Spot {b.spot_id}
                    </span>
                    <span
                      className={
                        b.status === "reserved"
                          ? "rounded-full bg-reserved/15 px-2.5 py-1 text-xs font-medium text-reserved"
                          : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4" /> {b.floor_name ?? "Garage A"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4" /> {new Date(b.reserved_at).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}