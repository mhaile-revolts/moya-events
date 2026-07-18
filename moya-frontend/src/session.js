export async function loadSession() {
  try { return JSON.parse(localStorage.getItem('moya_session')); } catch { return null; }
}
export async function saveSession(session) {
  localStorage.setItem('moya_session', JSON.stringify(session));
}
export async function clearSession() {
  localStorage.removeItem('moya_session');
}
