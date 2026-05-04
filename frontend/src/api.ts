/** Base URL for the Render API (no trailing slash). Required in production builds. */
export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
}

export type PackageRow = {
  id: string;
  label: string;
  priceUgx: number;
  durationHours: number;
};

export async function fetchPackages(): Promise<PackageRow[]> {
  const root = getApiBaseUrl();
  if (import.meta.env.PROD && !root) {
    throw new Error("missing_vite_api_url");
  }
  const url = `${root}/api/packages`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("packages_failed");
  const data = (await r.json()) as { packages: PackageRow[] };
  return data.packages;
}

export type InitiateResult =
  | {
      reference: string;
      status: "completed";
      accessToken: string;
      expiresAt: string;
    }
  | {
      reference: string;
      status: "pending";
      amountUgx: number;
      phone: string;
      message: string;
    };

export async function initiatePayment(body: {
  packageId: string;
  phone: string;
  clientMac?: string;
}): Promise<InitiateResult> {
  const root = getApiBaseUrl();
  const r = await fetch(`${root}/api/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "initiate_failed");
  }
  return r.json() as Promise<InitiateResult>;
}

export async function pollPayment(reference: string): Promise<{
  reference: string;
  status: string;
  accessToken?: string;
  expiresAt?: string;
  durationHours?: number;
}> {
  const root = getApiBaseUrl();
  const r = await fetch(`${root}/api/payments/${reference}/status`);
  if (!r.ok) throw new Error("status_failed");
  return r.json();
}

export const ACCESS_TOKEN_KEY = "hotspot_access_token";
export const ACCESS_EXPIRES_KEY = "hotspot_expires_at";
