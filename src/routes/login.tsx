import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Flame, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { defaultRouteForRole } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — Ember & Oak" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { authenticate } = useStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim() || !password) {
      setError("Please enter your username/email and password.");
      return;
    }

    try {
      setSubmitting(true);
      const role = authenticate(identifier, password);
      toast.success("Welcome back.");
      navigate({ to: defaultRouteForRole(role) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-muted/30 px-4 py-10">
      <div className="m-auto w-full max-w-md rounded-[2rem] border border-border bg-card p-8 shadow-elegant md:p-10">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-ember shadow-ember">
          <Flame className="size-7 text-primary-foreground" />
        </div>

        <div className="mt-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
            Ember & Oak
          </p>
          <h1 className="mt-2 font-display text-5xl leading-none">Login</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            One sign-in for customers, branch managers, and main admin.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="identifier" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Username or Email
            </label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin or your@email.com"
              autoComplete="username"
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                className="h-12 rounded-xl pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-full bg-gradient-ember text-primary-foreground shadow-ember hover:opacity-90"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Login"}
          </Button>
        </form>

        <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
          <p className="font-semibold uppercase tracking-[0.18em] text-foreground/80">
            Demo Access
          </p>
          <div className="mt-2 space-y-1">
            <p><span className="font-medium text-foreground">Main Admin:</span> `admin` / `mainadmin`</p>
            <p><span className="font-medium text-foreground">Branch Managers:</span> `branch1` / `b1` through `branch4` / `b4`</p>
            <p><span className="font-medium text-foreground">Customers:</span> sign up, then use your email and password</p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Customer only:{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create Customer Account
          </Link>
        </div>
      </div>
    </div>
  );
}
