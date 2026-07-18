const API_BASE = import.meta.env.VITE_API_BASE;

export async function apiFetch(path, { method = "GET", body, token } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error("Can't reach the backend. Is `docker compose up` running on your machine?");
    err.network = true;
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data && data.code;
    throw err;
  }
  return data;
}

export async function downloadApplePass(ticketNumber, token) {
  const res = await fetch(`${API_BASE}/tickets/${ticketNumber}/apple-pass`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ticketNumber}.pkpass`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function openGoogleWalletLink(ticketNumber, token) {
  const data = await apiFetch(`/tickets/${ticketNumber}/google-wallet-link`, { token });
  window.open(data.url, "_blank");
}
