// Client for the publisher's console.
//
// The console is not the back office. The back office belongs to the client
// organisation and manages its members; the console belongs to the publisher and
// watches the platform. That boundary is the reason this is a separate application
// with its own repository, and it is why this client deliberately calls only the
// support and observability surfaces. It has no function for reading a member file,
// so no screen can accidentally acquire one.

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "https://adsum-api.vercel.app";

export interface Session {
  token: string;
  role: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function deviceId(): string {
  if (typeof localStorage === "undefined") return "";
  let id = localStorage.getItem("adsum.device.id");
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("adsum.device.id", id);
  }
  return id;
}

function loginError(status: number): ApiError {
  if (status === 401) return new ApiError("Identifiants invalides ou mot de passe temporaire expiré.", status);
  if (status === 429) return new ApiError("Trop de tentatives. Patientez quelques minutes, puis réessayez.", status);
  if (status === 400) return new ApiError("Code incorrect ou expiré. Vérifiez et réessayez.", status);
  return new ApiError("Service momentanément indisponible.", status);
}

export interface LoginResult {
  otpRequired: boolean;
  session: Session | null;
  canal: string | null;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Device-Id": deviceId() },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw loginError(res.status);
  const data = (await res.json()) as {
    otp_required?: boolean;
    access_token?: string | null;
    role?: string;
    canal?: string | null;
  };
  return {
    otpRequired: Boolean(data.otp_required),
    session: data.access_token ? { token: data.access_token, role: data.role ?? "" } : null,
    canal: data.canal ?? null,
  };
}

export async function loginVerify(email: string, password: string, code: string, faireConfiance: boolean): Promise<Session> {
  const res = await fetch(`${BASE}/api/v1/auth/login-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Device-Id": deviceId() },
    body: JSON.stringify({ email, password, code, faire_confiance: faireConfiance }),
  });
  if (!res.ok) throw loginError(res.status);
  const data = (await res.json()) as { access_token?: string | null; role?: string };
  if (!data.access_token) throw loginError(401);
  return { token: data.access_token, role: data.role ?? "" };
}

/**
 * Whether this account may use the console at all.
 *
 * Resolved by asking the server rather than by inspecting the role in the token: the
 * permission is what the API enforces, and a client that decides for itself will
 * eventually disagree with it and show a screen every action then refuses.
 */
export async function aAccesConsole(token: string): Promise<boolean> {
  const res = await fetch(`${BASE}/api/v1/support/console/synthese`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

async function lire<T>(chemin: string, token: string, erreur: string): Promise<T> {
  const res = await fetch(`${BASE}${chemin}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ApiError(await detail(res, erreur), res.status);
  return (await res.json()) as T;
}

async function ecrire<T>(chemin: string, token: string, methode: "POST" | "PATCH" | "PUT", corps: unknown, erreur: string): Promise<T> {
  const res = await fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  if (!res.ok) throw new ApiError(await detail(res, erreur), res.status);
  return (await res.json()) as T;
}

/** The server's own wording when it has one: it names the actual rule that refused. */
async function detail(res: Response, repli: string): Promise<string> {
  try {
    const d = (await res.json()) as { detail?: unknown };
    if (typeof d.detail === "string" && d.detail.trim()) return d.detail;
  } catch {
    // A non-JSON body is not worth reporting; the fallback says enough.
  }
  return repli;
}

/* ---- Support ------------------------------------------------------------- */

export type StatutFil = "nouveau" | "en_cours" | "en_attente" | "resolu" | "clos";
export type Priorite = "basse" | "normale" | "haute" | "critique";

export interface FilSupport {
  id: string;
  reference: string;
  sujet: string;
  statut: StatutFil;
  ouvert: boolean;
  priorite: Priorite;
  categorie: string;
  canal: "application" | "email";
  application: string | null;
  demandeur_nom: string | null;
  demandeur_email: string | null;
  assigne_a: string | null;
  assigne_nom: string | null;
  messages: number | null;
  cree_le: string | null;
  maj_le: string | null;
  derniere_reponse_le: string | null;
  ferme_le: string | null;
}

export interface EchangeSupport {
  id: string;
  entrant: boolean;
  auteur_nom: string | null;
  corps: string;
  envoye: boolean;
  erreur_envoi: string | null;
  cree_le: string | null;
}

export interface FileSupport {
  total: number;
  decalage: number;
  limite: number;
  fils: FilSupport[];
}

export interface SyntheseSupport {
  par_statut: Record<StatutFil, number>;
  ouverts: number;
  jamais_repondus: number;
  plus_ancienne_attente_heures: number;
  non_assignes: number;
  reponses_non_parties: number;
}

export function getSynthese(token: string): Promise<SyntheseSupport> {
  return lire<SyntheseSupport>("/api/v1/support/console/synthese", token, "Synthèse indisponible");
}

export function getFile(
  token: string,
  filtres: { statut: string; assigne: string; recherche: string; decalage: number; limite: number },
): Promise<FileSupport> {
  const q = new URLSearchParams({
    statut: filtres.statut,
    assigne: filtres.assigne,
    recherche: filtres.recherche,
    decalage: String(filtres.decalage),
    limite: String(filtres.limite),
  });
  return lire<FileSupport>(`/api/v1/support/console/fils?${q}`, token, "File indisponible");
}

export function getFil(token: string, id: string): Promise<FilSupport & { echanges: EchangeSupport[] }> {
  return lire(`/api/v1/support/console/fils/${id}`, token, "Demande introuvable");
}

export function majFil(
  token: string,
  id: string,
  patch: { statut?: StatutFil; priorite?: Priorite; assigne_a?: string },
): Promise<FilSupport> {
  return ecrire(`/api/v1/support/console/fils/${id}`, token, "PATCH", patch, "Modification impossible");
}

export function repondre(
  token: string,
  id: string,
  message: string,
  clore: boolean,
): Promise<{ ok: boolean; envoye: boolean; statut: StatutFil }> {
  return ecrire(`/api/v1/support/console/fils/${id}/reponses`, token, "POST", { message, clore }, "Envoi impossible");
}

export function getAgents(token: string): Promise<{ id: string; email: string }[]> {
  return lire<{ id: string; email: string }[]>("/api/v1/support/console/agents", token, "Agents indisponibles");
}

/* ---- Santé des envois ----------------------------------------------------- */

export interface SanteEnvois {
  jours: number;
  par_statut: Record<string, number>;
  echecs: number;
  succes: number;
  en_vol: number;
  /** Failures to reserved domains, counted but kept out of the rate. */
  echecs_adresses_fictives: number;
  echecs_reels: number;
  taux_echec: number;
  motifs: { motif: string; n: number }[];
  domaines: { domaine: string; echecs: number; adresses: number }[];
  jour_par_jour: { jour: string; echecs: number; succes: number }[];
}

export interface DestinatairesEnEchec {
  total: number;
  affiches: number;
  note: string;
  /** Addresses are masked: the console diagnoses the platform, not its members. */
  destinataires: { adresse: string; echecs: number; motif: string; dernier: string | null }[];
}

export function getSanteEnvois(token: string, jours: number): Promise<SanteEnvois> {
  return lire<SanteEnvois>(`/api/v1/support/console/envois?jours=${jours}`, token, "Santé des envois indisponible");
}

export function getDestinatairesEnEchec(token: string, jours: number): Promise<DestinatairesEnEchec> {
  return lire<DestinatairesEnEchec>(
    `/api/v1/support/console/envois/destinataires?jours=${jours}&limite=25`,
    token,
    "Destinataires indisponibles",
  );
}
