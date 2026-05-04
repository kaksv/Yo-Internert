import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACCESS_EXPIRES_KEY,
  ACCESS_TOKEN_KEY,
  fetchPackages,
  initiatePayment,
  pollPayment,
  type PackageRow,
} from "./api";

function formatUgx(n: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function App() {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    expiresAt: string;
    token: string;
  } | null>(null);

  useEffect(() => {
    fetchPackages()
      .then((p) => {
        setPackages(p);
        if (p[0]) setSelectedId(p[0].id);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "missing_vite_api_url") {
          setError(
            "VITE_API_URL is not set for this build. In Vercel → Project → Settings → Environment Variables, add VITE_API_URL = your Render API base URL (e.g. https://hotspot-api.onrender.com), then Redeploy."
          );
        } else {
          setError(
            "Could not load plans. Check: (1) Vercel has VITE_API_URL pointing at Render, (2) On Render, CORS_ORIGIN includes this Vercel URL, (3) The API is running. Open the Network tab and look for /api/packages."
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => packages.find((p) => p.id === selectedId) ?? null,
    [packages, selectedId]
  );

  useEffect(() => {
    const t = localStorage.getItem(ACCESS_TOKEN_KEY);
    const exp = localStorage.getItem(ACCESS_EXPIRES_KEY);
    if (t && exp && new Date(exp).getTime() > Date.now()) {
      setSuccess({ token: t, expiresAt: exp });
    }
  }, []);

  useEffect(() => {
    if (!pendingRef) return;
    const id = window.setInterval(async () => {
      try {
        const s = await pollPayment(pendingRef);
        if (s.status === "completed" && s.accessToken && s.expiresAt) {
          localStorage.setItem(ACCESS_TOKEN_KEY, s.accessToken);
          localStorage.setItem(ACCESS_EXPIRES_KEY, s.expiresAt);
          setSuccess({ token: s.accessToken, expiresAt: s.expiresAt });
          setPendingRef(null);
          setBusy(false);
        }
        if (s.status === "failed") {
          setError("Payment failed or was cancelled.");
          setPendingRef(null);
          setBusy(false);
        }
      } catch {
        /* keep polling */
      }
    }, 2500);
    return () => window.clearInterval(id);
  }, [pendingRef]);

  const onPay = useCallback(async () => {
    if (!selected) return;
    setError(null);
    setBusy(true);
    try {
      const res = await initiatePayment({
        packageId: selected.id,
        phone,
      });
      if (res.status === "completed") {
        localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
        localStorage.setItem(ACCESS_EXPIRES_KEY, res.expiresAt);
        setSuccess({ token: res.accessToken, expiresAt: res.expiresAt });
        setBusy(false);
        return;
      }
      setPendingRef(res.reference);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment could not start.");
      setBusy(false);
    }
  }, [phone, selected]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-zinc-950 text-zinc-100">
        <p className="text-sm text-zinc-400">Loading plans…</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-zinc-950 px-6 py-12 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
            Connected
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Internet access is active
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Session valid until{" "}
            <span className="text-zinc-200">
              {new Date(success.expiresAt).toLocaleString()}
            </span>
            . You can close this page; your router should allow traffic until
            then.
          </p>
          <button
            type="button"
            className="mt-8 w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-white"
            onClick={() => {
              localStorage.removeItem(ACCESS_TOKEN_KEY);
              localStorage.removeItem(ACCESS_EXPIRES_KEY);
              setSuccess(null);
            }}
          >
            Buy another session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 font-sans">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-10 pt-14">
        <header className="mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-amber-400/90">
            Welcome
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Wi‑Fi access
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Choose a plan, pay with mobile money, then browse for the time shown.
          </p>
        </header>

        {error && (
          <p
            className="mb-8 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}

        <section aria-label="Plans">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Plans
          </p>
          <div className="grid gap-3">
            {packages.length === 0 && !error && (
              <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4 text-sm text-zinc-400">
                No plans returned from the API. If the API is healthy, seed the database (e.g.{" "}
                <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                  npx prisma db seed
                </code>{" "}
                against your production database).
              </p>
            )}
            {packages.map((p) => {
              const active = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                    active
                      ? "border-amber-400/60 bg-amber-400/10"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  }`}
                >
                  <div>
                    <p className="font-medium text-white">{p.label}</p>
                    <p className="text-sm text-zinc-500">
                      {p.durationHours} hours of access
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums text-white">
                      UGX {formatUgx(p.priceUgx)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-10" aria-label="Payment">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Mobile money number
          </p>
          <label className="sr-only" htmlFor="phone">
            Phone number paying with mobile money
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="e.g. 077… or 25677…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-3.5 text-base text-white outline-none ring-amber-400/40 placeholder:text-zinc-600 focus:border-amber-400/50 focus:ring-2"
          />
          <p className="mt-2 text-xs text-zinc-500">
            You&apos;ll approve the prompt on that wallet when payment mode is live.
          </p>
        </section>

        {pendingRef && (
          <p className="mt-6 text-center text-sm text-amber-200/90">
            Waiting for payment confirmation… Approve the prompt on your phone.
          </p>
        )}

        <div className="mt-auto pt-10">
          <button
            type="button"
            disabled={busy || !selected || phone.replace(/\D/g, "").length < 9}
            onClick={onPay}
            className="w-full rounded-2xl bg-amber-400 px-4 py-4 text-base font-semibold text-zinc-950 shadow-lg shadow-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-amber-300"
          >
            {busy ? "Processing…" : "Pay with mobile money"}
          </button>
        </div>
      </div>
    </div>
  );
}
