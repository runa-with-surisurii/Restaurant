import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Sign Up — Ember & Oak" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { signUpCustomer } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      signUpCustomer({ name, email, phone, password });
      toast.success("Customer account created.");
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-muted/30 px-4 py-10">
      <div className="m-auto w-full max-w-lg rounded-[2rem] border border-border bg-card p-8 shadow-elegant md:p-10">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-ember shadow-ember">
          <Flame className="size-7 text-primary-foreground" />
        </div>

        <div className="mt-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
            Ember & Oak
          </p>
          <h1 className="mt-2 font-display text-5xl leading-none">Customer Sign Up</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Create your customer account and we&apos;ll sign you in right away.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 grid gap-4 md:grid-cols-2">
          <Field label="Full Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl" />
          </Field>
          <Field label="Phone Number">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-xl" />
          </Field>
          <Field label="Email" className="md:col-span-2">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" />
          </Field>
          <Field label="Confirm Password">
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 rounded-xl" />
          </Field>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive md:col-span-2">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={submitting}
            className="h-12 rounded-full bg-gradient-ember text-primary-foreground shadow-ember hover:opacity-90 md:col-span-2"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-1.5 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
