export function getIntakeUrl() {
  const url = import.meta.env.VITE_INTAKE_URL;
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('VITE_INTAKE_URL is missing. Copy frontend/.env.example to frontend/.env.local.');
  }
  return url.trim();
}

export async function postIntake(claim) {
  if (typeof claim !== 'string' || !claim.trim()) {
    throw new Error('Claim is required.');
  }

  const response = await fetch(getIntakeUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ claim: claim.trim() }),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Intake returned non-JSON (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const message =
      data && typeof data.error === 'string' && data.error
        ? data.error
        : `Intake failed (HTTP ${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.job = data?.job ?? null;
    throw error;
  }

  if (!data || typeof data !== 'object' || !data.job) {
    throw new Error('Intake JSON did not include job.');
  }

  return data.job;
}
