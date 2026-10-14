import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, ShieldCheck, LayoutGrid, FileCheck2, Package } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [welcomeName, setWelcomeName] = useState("");
  const welcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    try {
      const fullName = await login(email, password);
      setWelcomeName(fullName?.trim() || "");
      setShowWelcome(true);

      if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
      welcomeTimerRef.current = setTimeout(() => {
        navigate("/");
      }, 2500);
      return;
    } catch (error: any) {
      console.error("Login error:", error);

      const isInvalidCredentials =
        error.message?.includes("INVALID_LOGIN_CREDENTIALS") ||
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password";

      if (isInvalidCredentials) {
        setLoginError("Invalid Email or password");
      } else if (error.message?.includes("Failed to fetch") || error.code === "auth/network-request-failed") {
        toast.error("Network connection error. Please check your internet connection and try again.");
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many failed login attempts. Please try again later.");
      } else {
        toast.error(error.message || "Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(39,60,112,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(234,23,38,0.12),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] text-slate-900 animate-fade-in motion-reduce:animate-none">
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-md animate-fade-in motion-reduce:animate-none">
          <div className="w-full max-w-sm rounded-3xl border border-white/40 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.25)] animate-scale-in motion-reduce:animate-none">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div className="mt-6 text-center">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Signed in successfully
              </span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                Welcome{welcomeName ? `, ${welcomeName}` : ""}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                You have successfully signed in to Avira Project Management Portal.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Redirecting to dashboard...
            </div>
          </div>
        </div>
      )}

      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.04fr_0.96fr]">
        <section
          className="relative isolate hidden min-h-dvh flex-col justify-between overflow-hidden px-6 py-7 text-white lg:flex lg:px-14 lg:py-12 xl:px-20"
          style={{ background: "linear-gradient(160deg, #273C70 0%, #273C70 58%, #EA1726 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 -left-28 h-96 w-96 rounded-full bg-red-500/20 blur-3xl" />

          <div className="relative animate-slide-in-from-bottom motion-reduce:animate-none">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg shadow-slate-950/10 backdrop-blur-sm">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-white/70 sm:text-sm">Avira Technologies</p>
                <h1 className="text-base font-semibold tracking-tight sm:text-lg">Project Management Portal</h1>
              </div>
            </div>

            <div className="mt-8 max-w-xl space-y-4 sm:mt-10 lg:mt-24">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-50 shadow-sm backdrop-blur-sm sm:text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-red-200" />
                Secure business workspace
              </div>
              <h2 className="max-w-lg text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl xl:text-[3.5rem]">
                Manage your work. Move forward with clarity.
              </h2>
              <p className="max-w-lg text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
                Inventory, delivery challans, and project tracking come together in one reliable workspace.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 lg:hidden">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/85">Inventory</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/85">Projects</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/85">Operations</span>
            </div>
          </div>

          <div className="relative mt-8 hidden max-w-xl grid-cols-3 gap-3 text-sm text-white/85 lg:grid">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <LayoutGrid className="mb-4 h-5 w-5 text-white/90" />
              <p className="font-medium text-white">Clear overview</p>
              <p className="mt-1 text-xs leading-5 text-white/65">Keep day-to-day work organized.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <Package className="mb-4 h-5 w-5 text-white/90" />
              <p className="font-medium text-white">Connected operations</p>
              <p className="mt-1 text-xs leading-5 text-white/65">Find key records in one place.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <FileCheck2 className="mb-4 h-5 w-5 text-white/90" />
              <p className="font-medium text-white">Reliable tracking</p>
              <p className="mt-1 text-xs leading-5 text-white/65">Follow progress with confidence.</p>
            </div>
          </div>

          <div className="relative mt-7 hidden items-center gap-2 text-xs text-white/55 lg:flex">
            <ShieldCheck className="h-4 w-4" />
            <span>Avira Technologies · Business operations platform</span>
          </div>
        </section>

        <section className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-white/45 px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-12 h-56 w-56 rounded-full bg-red-100/60 blur-3xl" />
          <div className="relative w-full max-w-md animate-slide-in-from-bottom motion-reduce:animate-none">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.09)] sm:p-9 lg:p-10">
              <div className="mb-7 flex justify-center sm:mb-9">
                <img
                  src="https://cdn.builder.io/api/v1/image/assets%2F8934386caff3497686ed90270fdd753f%2F90e618d4a91e478a964d0f3d54315cbe?format=webp&width=800&height=1200"
                  alt="Avira Technologies Logo"
                  className="h-14 max-w-[190px] object-contain animate-scale-in motion-reduce:animate-none sm:h-16"
                />
              </div>

              <div className="mb-7 text-center sm:mb-8">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#273C70]">Welcome back</p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Sign in to your account</h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  Access your Avira project workspace securely.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">Email address</label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    disabled={loading}
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 px-4 text-sm shadow-none transition focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#273C70]"
                    style={{ "--tw-ring-color": "#273C70" } as React.CSSProperties}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password</label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      disabled={loading}
                      className="h-12 rounded-xl border-slate-200 bg-slate-50 px-4 pr-12 text-sm shadow-none transition focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#273C70]"
                      style={{ "--tw-ring-color": "#273C70" } as React.CSSProperties}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-700 disabled:opacity-50"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-[#273C70] text-sm font-semibold text-white shadow-lg shadow-[#273C70]/20 transition hover:bg-[#1e315e] active:scale-[0.99]"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              {loginError && (
                <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
                  {loginError}
                </div>
              )}

              <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-400 sm:mt-8">
                <ShieldCheck className="h-4 w-4 text-[#273C70]" />
                <span>Secure sign-in powered by Avira Technologies</span>
              </div>
            </div>
            <p className="mt-5 text-center text-xs text-slate-400">Authorized access only</p>
          </div>
        </section>
      </div>
    </main>
  );
}
