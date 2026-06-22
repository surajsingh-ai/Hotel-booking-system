import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hotel, Menu, User, Globe, Sun, X, BookOpen, LogOut, ChevronDown, ShieldCheck } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { loginUser, registerUser, type User as UserType } from "@/lib/api";

const Header = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    try { return JSON.parse(localStorage.getItem("staykart_user") || "null"); } catch { return null; }
  });
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [mounted, setMounted] = useState(false);
  const { setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    setTheme("light");
  }, [setTheme]);

  const navLinks = [
    { label: "Hotels", href: "#hotels" },
    { label: "Destinations", href: "#destinations" },
    { label: "Deals", href: "#deals" },
    { label: "Help", href: "#" },
  ];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error("Please fill in all fields");
    if (!isLogin && !form.name) return toast.error("Please enter your name");
    setLoading(true);
    try {
      const result = isLogin
        ? await loginUser(form.email, form.password)
        : await registerUser(form.name, form.email, form.password);
      localStorage.setItem("staykart_user", JSON.stringify(result.user));
      setCurrentUser(result.user);
      toast.success(isLogin ? "Signed in successfully!" : "Account created!", {
        description: `Welcome, ${result.user.name}!`,
      });
      setAuthOpen(false);
      setForm({ name: "", email: "", password: "" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("staykart_user");
    setCurrentUser(null);
    toast.success("Signed out successfully");
  };

  return (
    <>
      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 text-white">
            <div className="size-10 rounded-xl gradient-cta flex items-center justify-center shadow-cta">
              <Hotel className="size-5" strokeWidth={2.5} />
            </div>
            <span className="font-display text-2xl">StayKart</span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-white/90 text-sm font-medium">
            {navLinks.map((l) => (
              <a key={l.label} href={l.href} className="hover:text-white transition-smooth">{l.label}</a>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/90 hover:bg-white/10 hover:text-white"
              onClick={() => setTheme("light")}
            >
              {mounted && <Sun className="size-4" />}
            </Button>
            <Button variant="ghost" size="sm" className="text-white/90 hover:bg-white/10 hover:text-white" >
              <Globe className="size-4" /> EN / INR
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/90 hover:bg-white/10 hover:text-white"
              onClick={() => navigate("/bookings")}
            >
              <BookOpen className="size-4" /> My Bookings
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/90 hover:bg-white/10 hover:text-white"
              onClick={() => navigate("/admin/login")}
            >
              <ShieldCheck className="size-4" /> Admin
            </Button>
            {currentUser ? (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="text-white/90 hover:bg-white/10 hover:text-white">
                  <User className="size-4" />
                  <span className="max-w-[100px] truncate">{currentUser.name}</span>
                  <ChevronDown className="size-3" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="text-white/90 hover:bg-white/10 hover:text-white"
                  onClick={handleLogout}
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost" size="sm"
                className="text-white/90 hover:bg-white/10 hover:text-white"
                onClick={() => { setIsLogin(true); setAuthOpen(true); }}
              >
                <User className="size-4" /> Sign in
              </Button>
            )}
          </div>

          {/* Mobile hamburger */}
          <Button
            size="sm"
            className="md:hidden bg-white/85 hover:bg-white text-foreground/80"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-background/95 dark:bg-foreground/95 backdrop-blur-md flex flex-col p-6">
          <div className="flex items-center justify-between mb-10">
            <a href="/" className="flex items-center gap-2 text-foreground dark:text-white">
              <div className="size-10 rounded-xl gradient-cta flex items-center justify-center shadow-cta">
                <Hotel className="size-5" strokeWidth={2.5} />
              </div>
              <span className="font-display text-2xl text-foreground dark:text-white">StayKart</span>
            </a>
            <button onClick={() => setMobileOpen(false)} className="text-foreground/70 dark:text-white/70 hover:text-foreground dark:hover:text-white">
              <X className="size-6" />
            </button>
          </div>
          {currentUser && (
            <div className="mb-4 px-1 py-3 border-b border-border text-foreground/70 dark:text-white/70 text-sm flex items-center gap-2">
              <User className="size-4" /> Signed in as <span className="font-semibold text-foreground dark:text-white">{currentUser.name}</span>
            </div>
          )}
          <nav className="flex flex-col gap-2 flex-1">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="text-foreground/85 dark:text-white/85 hover:text-foreground dark:hover:text-white text-2xl font-display py-3 border-b border-border transition-smooth"
              >
                {l.label}
              </a>
            ))}
            <button
              onClick={() => { setMobileOpen(false); navigate("/bookings"); }}
              className="text-foreground/85 hover:text-primary text-2xl font-display py-3 border-b border-border transition-smooth text-left flex items-center gap-3"
            >
              <BookOpen className="size-5" /> My Bookings
            </button>
            <button
              onClick={() => { setMobileOpen(false); navigate("/admin/login"); }}
              className="text-foreground/85 hover:text-primary text-2xl font-display py-3 border-b border-border transition-smooth text-left flex items-center gap-3"
            >
              <ShieldCheck className="size-5" /> Admin
            </button>
          </nav>
          <div className="flex gap-3 mt-8">
            {currentUser ? (
              <Button
                className="flex-1 bg-background/90 border border-border text-foreground hover:bg-background/95 dark:bg-white/10 dark:border-white/20 dark:text-white dark:hover:bg-white/20"
                variant="outline"
                onClick={() => { setMobileOpen(false); handleLogout(); }}
              >
                <LogOut className="size-4" /> Sign out
              </Button>
            ) : (
              <>
                <Button
                  className="flex-1 gradient-cta border-0 shadow-cta"
                  onClick={() => { setMobileOpen(false); setIsLogin(false); setAuthOpen(true); }}
                >
                  Register
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 bg-background/90 border border-border text-foreground hover:bg-background/95 dark:bg-white/10 dark:border-white/20 dark:text-white dark:hover:bg-white/20"
                  onClick={() => { setMobileOpen(false); setIsLogin(true); setAuthOpen(true); }}
                >
                  Sign in
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Auth modal */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {isLogin ? "Welcome back" : "Create account"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAuth} className="space-y-4 mt-2">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-name">Full name</Label>
                <Input
                  id="auth-name"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                placeholder="john@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              {!isLogin && (
                <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full gradient-cta border-0 shadow-cta font-bold"
              disabled={loading}
            >
              {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              className="text-primary font-semibold hover:underline"
              onClick={() => { setIsLogin(!isLogin); setForm({ name: "", email: "", password: "" }); }}
            >
              {isLogin ? "Register" : "Sign in"}
            </button>
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Header;
