import { useState } from "react";

import {
  ApiError,
  getAgents,
  getFil,
  majFil,
  repondre,
  type Priorite,
  type StatutFil,
} from "../api.js";
import { useResource } from "../useResource.js";

const STATUTS: { cle: StatutFil; libelle: string }[] = [
  { cle: "nouveau", libelle: "Nouveau" },
  { cle: "en_cours", libelle: "En cours" },
  { cle: "en_attente", libelle: "En attente" },
  { cle: "resolu", libelle: "Résolu" },
  { cle: "clos", libelle: "Clos" },
];

const PRIORITES: { cle: Priorite; libelle: string }[] = [
  { cle: "basse", libelle: "Basse" },
  { cle: "normale", libelle: "Normale" },
  { cle: "haute", libelle: "Haute" },
  { cle: "critique", libelle: "Critique" },
];

/**
 * One conversation: what was said, and what to do about it.
 *
 * An answer that failed to leave is marked as such on the exchange itself. Without
 * that, a thread with a written reply looks handled, and the person on the other end
 * is still waiting for something nobody knows never arrived.
 *
 * Nothing here links to a member file, by construction: the API this screen talks to
 * has no such endpoint. Support fixes the platform; reading someone's record belongs
 * to the back office, where that access is governed and audited.
 */
export function Conversation({
  token,
  filId,
  onRetour,
}: {
  token: string;
  filId: string;
  onRetour: () => void;
}): JSX.Element {
  const fil = useResource(() => getFil(token, filId), [token, filId]);
  const agents = useResource(() => getAgents(token), [token]);
  const [message, setMessage] = useState("");
  const [clore, setClore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function agir(action: () => Promise<unknown>, succes: string): Promise<void> {
    setBusy(true);
    setErreur(null);
    setNote(null);
    try {
      await action();
      setNote(succes);
      fil.reload();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  async function envoyer(): Promise<void> {
    setBusy(true);
    setErreur(null);
    setNote(null);
    try {
      const r = await repondre(token, filId, message.trim(), clore);
      // The outcome of the send is reported, not assumed: writing an answer and
      // delivering it are two different events, and only one of them is certain.
      setNote(
        r.envoye
          ? "Réponse envoyée."
          : "Réponse enregistrée mais NON remise. Le demandeur ne l'a pas reçue : vérifiez le fournisseur d'envoi.",
      );
      setMessage("");
      setClore(false);
      fil.reload();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  const d = fil.data;

  return (
    <section>
      <button type="button" className="bouton bouton-discret" onClick={onRetour} style={{ marginBottom: 16 }}>
        Retour à la file
      </button>

      {fil.error && <p className="bandeau bandeau-erreur">{fil.error}</p>}
      {erreur && <p className="bandeau bandeau-erreur">{erreur}</p>}
      {note && <p className={`bandeau ${note.includes("NON remise") ? "bandeau-erreur" : "bandeau-ok"}`}>{note}</p>}

      {d && (
        <>
          <header className="tete">
            <h1>{d.sujet}</h1>
            <p className="mono">
              {d.reference} · {d.demandeur_nom || d.demandeur_email} · {d.demandeur_email}
              {d.canal === "email" ? " · reçue par courriel" : " · ouverte dans l'application"}
              {d.application ? ` · ${d.application}` : ""}
            </p>
          </header>

          <div className="carte">
            <div className="barre" style={{ marginBottom: 0 }}>
              <label className="case">
                <span className="small muted">État</span>
                <select
                  className="champ"
                  value={d.statut}
                  disabled={busy}
                  onChange={(e) => void agir(() => majFil(token, filId, { statut: e.target.value as StatutFil }), "État mis à jour.")}
                >
                  {STATUTS.map((s) => <option key={s.cle} value={s.cle}>{s.libelle}</option>)}
                </select>
              </label>
              <label className="case">
                <span className="small muted">Priorité</span>
                <select
                  className="champ"
                  value={d.priorite}
                  disabled={busy}
                  onChange={(e) => void agir(() => majFil(token, filId, { priorite: e.target.value as Priorite }), "Priorité mise à jour.")}
                >
                  {PRIORITES.map((p) => <option key={p.cle} value={p.cle}>{p.libelle}</option>)}
                </select>
              </label>
              <label className="case">
                <span className="small muted">Responsable</span>
                <select
                  className="champ"
                  value={d.assigne_a ?? ""}
                  disabled={busy}
                  onChange={(e) => void agir(() => majFil(token, filId, { assigne_a: e.target.value }), "Responsable mis à jour.")}
                >
                  <option value="">Sans responsable</option>
                  {(agents.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
                </select>
              </label>
              {!d.assigne_a && (
                <button
                  type="button"
                  className="bouton"
                  disabled={busy}
                  onClick={() => void agir(() => majFil(token, filId, { assigne_a: "moi", statut: "en_cours" }), "Vous avez pris cette demande.")}
                >
                  Prendre en charge
                </button>
              )}
            </div>
          </div>

          <div className="carte">
            <div className="echanges">
              {d.echanges.map((e) => (
                <div
                  key={e.id}
                  className={`echange ${e.entrant ? "echange-entrant" : "echange-sortant"}${!e.entrant && !e.envoye ? " echange-echec" : ""}`}
                >
                  <span className="echange-auteur">
                    {e.entrant ? (e.auteur_nom ?? "Le demandeur") : (e.auteur_nom ?? "Le support")}
                    {e.cree_le ? ` · ${new Date(e.cree_le).toLocaleString("fr-FR")}` : ""}
                    {!e.entrant && !e.envoye ? " · NON REMISE" : ""}
                  </span>
                  {e.corps}
                  {!e.entrant && !e.envoye && e.erreur_envoi && (
                    <span className="echange-auteur" style={{ marginTop: 6 }}>{e.erreur_envoi}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="repondre">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Votre réponse au demandeur. Elle lui est envoyée par courriel."
                maxLength={8000}
              />
              <div className="repondre-actions">
                <button type="button" className="bouton" disabled={busy || message.trim().length < 2} onClick={() => void envoyer()}>
                  Envoyer la réponse
                </button>
                <label className="case">
                  <input type="checkbox" checked={clore} onChange={(e) => setClore(e.target.checked)} />
                  <span>Clore la demande avec cette réponse</span>
                </label>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
