import { useState } from "react";

import {
  accorderLicence,
  ApiError,
  changerEtatOrganisation,
  creerOrganisation,
  getOrganisations,
  type EtatOrganisation,
  type OrganisationCliente,
} from "../api.js";
import { Provisionnement } from "./Provisionnement.js";
import { useResource } from "../useResource.js";

const LIBELLE_ETAT: Record<EtatOrganisation, string> = {
  evaluation: "En évaluation",
  active: "Active",
  suspendue: "Suspendue",
  resiliee: "Résiliée",
};

/**
 * The customers, and what each is entitled to.
 *
 * Sorted with what needs attention first: suspended, then in evaluation, then running.
 * An alphabetical list buries the one organisation that is locked out under twenty
 * that are fine.
 *
 * Suspending demands a reason before the button does anything, because that reason is
 * what the client will be told when they call, and because the database refuses a
 * suspension without one anyway. Asking here turns a rejection into a question.
 */
export function Organisations({ token }: { token: string }): JSX.Element {
  const data = useResource(() => getOrganisations(token), [token]);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);

  async function agir(action: () => Promise<unknown>, succes: string): Promise<boolean> {
    setBusy(true);
    setErreur(null);
    setNote(null);
    try {
      await action();
      setNote(succes);
      data.reload();
      return true;
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Erreur réseau");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const d = data.data;

  return (
    <section>
      <header className="tete">
        <h1>Organisations clientes</h1>
        <p>
          Qui utilise la plateforme, sous quel contrat, et jusqu&apos;à quand. Une
          licence n&apos;est jamais modifiée : en accorder une nouvelle remplace la
          précédente, qui reste dans l&apos;historique.
        </p>
      </header>

      {data.error && <p className="bandeau bandeau-erreur">{data.error}</p>}
      {erreur && <p className="bandeau bandeau-erreur">{erreur}</p>}
      {note && <p className="bandeau bandeau-ok">{note}</p>}

      {d && (
        <div className="indicateurs">
          <div className="indicateur">
            <span className="indicateur-valeur">{d.total}</span>
            <span className="indicateur-libelle">Organisations</span>
          </div>
          <div className="indicateur">
            <span className="indicateur-valeur">{d.par_etat.active}</span>
            <span className="indicateur-libelle">Actives</span>
          </div>
          <div className={`indicateur${d.par_etat.suspendue > 0 ? " indicateur-alerte" : ""}`}>
            <span className="indicateur-valeur">{d.par_etat.suspendue}</span>
            <span className="indicateur-libelle">Suspendues</span>
          </div>
          <div className={`indicateur${d.par_etat.evaluation > 0 ? " indicateur-attention" : ""}`}>
            <span className="indicateur-valeur">{d.par_etat.evaluation}</span>
            <span className="indicateur-libelle">En évaluation</span>
          </div>
        </div>
      )}

      <div className="barre">
        <button type="button" className="bouton" onClick={() => setCreation(!creation)}>
          {creation ? "Annuler" : "Enregistrer une organisation"}
        </button>
      </div>

      {creation && (
        <FormulaireOrganisation
          busy={busy}
          onCreer={(o) =>
            void agir(() => creerOrganisation(token, o), "Organisation enregistrée, en évaluation.").then((ok) => {
              if (ok) setCreation(false);
            })
          }
        />
      )}

      <div className="file">
        {(d?.organisations ?? []).map((o) => (
          <Fiche
            key={o.id}
            token={token}
            organisation={o}
            ouverte={ouvert === o.id}
            busy={busy}
            onBasculer={() => setOuvert(ouvert === o.id ? null : o.id)}
            onEtat={(etat, motif) =>
              void agir(
                () => changerEtatOrganisation(token, o.id, etat, motif),
                `${o.nom} : ${LIBELLE_ETAT[etat].toLowerCase()}.`,
              )
            }
            onLicence={(l) => void agir(() => accorderLicence(token, o.id, l), `Licence accordée à ${o.nom}.`)}
          />
        ))}
      </div>

      {d && d.organisations.length === 0 && (
        <p className="vide">Aucune organisation enregistrée.</p>
      )}
    </section>
  );
}

function Fiche({
  token,
  organisation: o,
  ouverte,
  busy,
  onBasculer,
  onEtat,
  onLicence,
}: {
  token: string;
  organisation: OrganisationCliente;
  ouverte: boolean;
  busy: boolean;
  onBasculer: () => void;
  onEtat: (etat: EtatOrganisation, motif: string) => void;
  onLicence: (l: { formule: string; membres_inclus: number | null; debut: string; fin: string | null; gracieuse: boolean; motif: string }) => void;
}): JSX.Element {
  const [motifSuspension, setMotifSuspension] = useState("");
  const licence = o.licence;
  // A licence about to run out is worth flagging before it does, not after.
  const bientot = licence?.jours_restants != null && licence.jours_restants >= 0 && licence.jours_restants <= 30;

  return (
    <div className={`carte${o.etat === "suspendue" ? " " : ""}`} style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={onBasculer}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <strong style={{ fontSize: 15 }}>{o.nom}</strong>
          <span className="fil-meta mono">
            {o.code}
            {o.ville ? ` · ${o.ville}` : ""}
            {o.pays ? `, ${o.pays}` : ""}
            {licence ? ` · ${licence.formule}` : " · aucune licence"}
            {licence?.fin ? ` jusqu'au ${new Date(licence.fin).toLocaleDateString("fr-FR")}` : ""}
            {licence?.gracieuse ? " · gracieuse" : ""}
          </span>
        </span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {licence?.expiree && <span className="pastille pastille-en_cours">Licence expirée</span>}
          {bientot && !licence?.expiree && (
            <span className="pastille pastille-en_cours">{licence?.jours_restants} j restants</span>
          )}
          <span className={`pastille pastille-${o.etat === "suspendue" ? "nouveau" : o.etat === "active" ? "resolu" : "en_attente"}`}>
            {LIBELLE_ETAT[o.etat]}
          </span>
        </span>
      </button>

      {o.etat === "suspendue" && o.suspendue_motif && (
        <p className="bandeau bandeau-erreur" style={{ marginTop: 12, marginBottom: 0 }}>
          Suspendue : {o.suspendue_motif}
          {o.suspendue_le ? ` (le ${new Date(o.suspendue_le).toLocaleDateString("fr-FR")})` : ""}
        </p>
      )}

      {ouverte && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {(o.contact_nom || o.contact_email || o.contact_telephone) && (
            <p className="small muted" style={{ margin: 0 }}>
              Contact : {[o.contact_nom, o.contact_email, o.contact_telephone].filter(Boolean).join(" · ")}
            </p>
          )}
          {o.note && <p className="small muted" style={{ margin: 0 }}>{o.note}</p>}

          <div className="barre" style={{ marginBottom: 0 }}>
            {o.etat !== "active" && (
              <button type="button" className="bouton" disabled={busy} onClick={() => onEtat("active", "")}>
                Activer
              </button>
            )}
            {o.etat !== "suspendue" && (
              <>
                <input
                  className="champ champ-large"
                  placeholder="Motif de la suspension, communiqué au client"
                  value={motifSuspension}
                  onChange={(e) => setMotifSuspension(e.target.value)}
                />
                <button
                  type="button"
                  className="bouton bouton-discret"
                  disabled={busy || motifSuspension.trim().length < 3}
                  onClick={() => onEtat("suspendue", motifSuspension.trim())}
                >
                  Suspendre
                </button>
              </>
            )}
            {o.etat !== "resiliee" && (
              <button type="button" className="bouton bouton-discret" disabled={busy} onClick={() => onEtat("resiliee", "")}>
                Résilier
              </button>
            )}
          </div>

          <FormulaireLicence busy={busy} onAccorder={onLicence} />

          <details style={{ borderTop: "1px dashed var(--adsum-line)", paddingTop: 14 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              Mise en service : base, domaines et modules
            </summary>
            <div style={{ marginTop: 14 }}>
              <Provisionnement token={token} organisation={o} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function FormulaireOrganisation({
  busy,
  onCreer,
}: {
  busy: boolean;
  onCreer: (o: { code: string; nom: string; ville: string; pays: string; contact_nom: string; contact_email: string; note: string }) => void;
}): JSX.Element {
  const [v, setV] = useState({ code: "", nom: "", ville: "", pays: "", contact_nom: "", contact_email: "", note: "" });
  return (
    <div className="carte">
      <div className="barre" style={{ marginBottom: 8 }}>
        <input className="champ" placeholder="Nom de l'organisation" value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} />
        <input className="champ" placeholder="Code, par exemple paroisse-saint-jean" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} />
        <input className="champ" placeholder="Ville" value={v.ville} onChange={(e) => setV({ ...v, ville: e.target.value })} />
        <input className="champ" placeholder="Pays" value={v.pays} onChange={(e) => setV({ ...v, pays: e.target.value })} />
      </div>
      <div className="barre" style={{ marginBottom: 8 }}>
        <input className="champ" placeholder="Nom du contact" value={v.contact_nom} onChange={(e) => setV({ ...v, contact_nom: e.target.value })} />
        <input className="champ" type="email" placeholder="Courriel du contact" value={v.contact_email} onChange={(e) => setV({ ...v, contact_email: e.target.value })} />
        <input className="champ champ-large" placeholder="Note interne" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
      </div>
      <button type="button" className="bouton" disabled={busy || v.nom.trim().length < 2 || v.code.trim().length < 3} onClick={() => onCreer(v)}>
        Enregistrer
      </button>
      <p className="small muted" style={{ margin: "8px 0 0" }}>
        Une organisation démarre en évaluation, jamais active : donner l&apos;accès doit
        être une décision, pas un effet de bord de l&apos;enregistrement.
      </p>
    </div>
  );
}

function FormulaireLicence({
  busy,
  onAccorder,
}: {
  busy: boolean;
  onAccorder: (l: { formule: string; membres_inclus: number | null; debut: string; fin: string | null; gracieuse: boolean; motif: string }) => void;
}): JSX.Element {
  const [formule, setFormule] = useState("standard");
  const [membres, setMembres] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [gracieuse, setGracieuse] = useState(false);
  const [motif, setMotif] = useState("");

  return (
    <div style={{ borderTop: "1px dashed var(--adsum-line)", paddingTop: 14 }}>
      <p className="small muted" style={{ margin: "0 0 8px" }}>Accorder une licence, qui remplacera celle en cours.</p>
      <div className="barre" style={{ marginBottom: 8 }}>
        <input className="champ" placeholder="Formule" value={formule} onChange={(e) => setFormule(e.target.value)} />
        <input className="champ" type="number" min={1} placeholder="Membres inclus" value={membres} onChange={(e) => setMembres(e.target.value)} />
        <label className="case"><span className="small muted">Début</span>
          <input className="champ" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </label>
        <label className="case"><span className="small muted">Fin</span>
          <input className="champ" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
        </label>
      </div>
      <div className="barre" style={{ marginBottom: 8 }}>
        <label className="case">
          <input type="checkbox" checked={gracieuse} onChange={(e) => setGracieuse(e.target.checked)} />
          <span>Licence gracieuse</span>
        </label>
        <input
          className="champ champ-large"
          placeholder={gracieuse ? "Pourquoi elle est gracieuse (obligatoire)" : "Motif ou référence de contrat"}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="bouton"
        disabled={busy || !debut || formule.trim().length < 2 || (gracieuse && motif.trim().length < 3)}
        onClick={() =>
          onAccorder({
            formule: formule.trim(),
            membres_inclus: membres ? Number(membres) : null,
            debut,
            fin: fin || null,
            gracieuse,
            motif: motif.trim(),
          })
        }
      >
        Accorder
      </button>
    </div>
  );
}
