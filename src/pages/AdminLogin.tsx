import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hotel, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAdmin } from "@/lib/api";
import heroHotel from "@/assets/hero-hotel.jpg";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "admin@staykart.local",
    password: "admin123",
  });

  useEffect(() => {
    if (localStorage.getItem("staykart_admin_token")) {
      navigate("/admin");
    }
  }, [navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const result = await loginAdmin(form.email, form.password);
      localStorage.setItem("staykart_admin_token", result.token);
      localStorage.setItem("staykart_admin", JSON.stringify(result.admin));
      toast.success("Admin signed in", { description: `Welcome, ${result.admin.name}` });
      navigate("/admin");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1fr_480px]">
        <section className="relative hidden overflow-hidden bg-foreground lg:block">
          <img src={heroHotel} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 gradient-hero" />
          <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
            <a href="/" className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg gradient-cta">
                <Hotel className="size-5" />
              </span>
              <span className="font-display text-3xl">StayKart</span>
            </a>
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm backdrop-blur">
                <ShieldCheck className="size-4" />
                Admin operations
              </div>
              <h1 className="max-w-2xl font-display text-6xl leading-tight">Manage bookings, inventory, hotels, and guest operations.</h1>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <a href="/" className="mb-10 flex items-center gap-3 text-foreground lg:hidden">
              <span className="flex size-10 items-center justify-center rounded-lg gradient-cta text-white">
                <Hotel className="size-5" />
              </span>
              <span className="font-display text-2xl">StayKart</span>
            </a>
            <div className="mb-8">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-accent">Control panel</span>
              <h2 className="font-display text-4xl">Admin Login</h2>
              <p className="mt-2 text-sm text-muted-foreground">Sign in to run booking website operations.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-card">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </div>
              <Button type="submit" className="w-full rounded-lg gradient-cta font-bold shadow-cta" disabled={loading}>
                <LockKeyhole className="size-4" />
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
};

export default AdminLogin;
