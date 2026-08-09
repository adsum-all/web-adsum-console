import { useEffect, useState } from "react";

import {
  ApiError,
  definirModules,
  diagnostiquer,
  getCatalogueModules,
  getHotes,
  rattacherHote,
  semerReferentiels,
  type Diagnostic,
  type HoteOrganisation,
  type ModuleCatalogue,
  type OrganisationCliente,
} from "../api.js";

/**
 * Bringing one client online, step by step, with nothing taken on trust.
 *
 * The target is a single button. Until every step is automatic, each client costs a day
 * of engineering and every forgotten step becomes an incident, so the screen shows the
 * whole sequence at once: what is done, what is missing, and for the one step that
 * cannot be automatic, the exact command to run.
 *
 * The connection string is typed here and never stored in the browser. It is the
 * credential of a whole organisation's database; keeping it in local storage so the
 * form is convenient on reload would leave it on a shared machine.
 *
 * Nothing here is a wizard that hides its state. An operator interrupted halfway must
 * be able to come back, paste the same connection string and see exactly where they
 * stopped, which is what makes a failed provisioning ordinary rather than a rollback.
 */
export function Provisionnement({
  token,
  organisation,
}: {
  token: string;
  organisation: OrganisationCliente;
}): JSX.Element {
  const [dsn, setDsn] = useState("");
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [hotes, setHotes] = useState<HoteOrganisation[]>([]);
  const [catalogue, setCatalogue] = useState<ModuleCatalogue[]>([]);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [nouvelHote, setNouvelHote] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void getCatalogueModules(token).then(setCatalogue).catch(() => undefined);
    void getHotes(token, organisation.id).then(setHotes).catch(() => undefined);
  }, [token, organisation.id]);

  async function agir(action: () => Promise<unknown>, succes: string): Promise<boolean> {
    setBusy(true);
    setErreur(null);
    setNote(null);
    try {
      await action();
      setNote(succes);
      return true;
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Erreur réseau");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const bloque = diagnostic?.etapes.some((e) => e.bloquant) ?? false;
  const schemaPret = diagnostic?.etapes.find((e) => e.code === "schema")?.fait ?? false;

  return (
    <section>
      <header className="tete">
        <h1>Mettre en service {organisation.nom}</h1>
        <p>
          Chaque étape est vérifiée avant et après, donc la séquence se reprend à tout
          moment : une mise en service qui échoue à mi-parcours est le cas ordinaire, pas
          l&apos;exception.
        </p>
      </header>

      {erreur && <p className="bandeau bandeau-erreur">{erreur}</p>}
      {note && <p className="bandeau bandeau-ok">{note}</p>}

      <div className="carte">
        <h2 style={{ fontSize: "var(--adsum-text-lg)", marginBottom: 4 }}>1. La base de cette organisation</h2>
        <p className="muted small" style={{ margin: "0 0 10px" }}>
          Sa chaîne de connexion, à elle seule. Elle n&apos;est pas conservée par le
          navigateur : c&apos;est l&apos;identifiant d&apos;une base entière, et une
          console s&apos;ouvre sur des postes partagés.
        </p>
        <div className="barre" style={{ marginBottom: 0 }}>
          <input
            className="champ champ-large"
            type="password"
            autoComplete="off"
            placeholder="postgresql://..."
            value={dsn}
            onChange={(e) => setDsn(e.target.value)}
          />
          <button
            type="button"
            className="bouton"
            disabled={busy || dsn.trim().length < 10}
            onClick={() =>
              void agir(
                () => diagnostiquer(token, organisation.id, dsn.trim()).then(setDiagnostic),
                "Diagnostic effectué. Rien n'a été modifié.",
              )
            }
          >
            Diagnostiquer
          </button>
        </div>
      </div>

      {diagnostic && (
        <div className="carte">
          <h2 style={{ fontSize: "var(--adsum-text-lg)", marginBottom: 4 }}>2. Où en est cette base</h2>
          <p className="muted small mono" style={{ margin: "0 0 12px" }}>
            Version de schéma attendue : {diagnostic.version_attendue}
          </p>

          {bloque && (
            <p className="bandeau bandeau-erreur">
              Cette base contient déjà des données. Rien ne sera écrit dedans : y semer des
              référentiels mêlerait deux organisations, ce que toute l&apos;architecture
              existe pour empêcher. Vérifiez la chaîne de connexion.
            </p>
          )}

          <div className="file">
            {diagnostic.etapes.map((e, i) => (
              <div key={e.code} className={`fil fil-${e.fait ? "normale" : "haute"}`} style={{ cursor: "default" }}>
                <span className="fil-bande" aria-hidden="true" />
                <span className="fil-corps">
                  <span className="fil-sujet">
                    {i + 1}. {e.libelle}
                  </span>
                  {e.detail && <span className="fil-meta mono">{e.detail}</span>}
                  {!e.fait && e.manuel && (
                    <span className="fil-meta" style={{ color: "var(--adsum-warn)" }}>
                      À exécuter : <span className="mono">{e.manuel}</span>
                    </span>
                  )}
                </span>
                <span className="fil-droite">
                  <span className={`pastille pastille-${e.fait ? "resolu" : "en_cours"}`}>
                    {e.fait ? "Fait" : "À faire"}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="barre" style={{ marginTop: 14, marginBottom: 0 }}>
            <button
              type="button"
              className="bouton"
              disabled={busy || bloque || !schemaPret}
              onClick={() =>
                void agir(
                  () =>
                    semerReferentiels(token, organisation.id, dsn.trim()).then(() =>
                      diagnostiquer(token, organisation.id, dsn.trim()).then(setDiagnostic),
                    ),
                  "Référentiels semés. Les identifiants n'ont pas été recopiés.",
                )
              }
            >
              Semer les référentiels
            </button>
            {!schemaPret && (
              <span className="small muted">
                Le schéma doit d&apos;abord être à la version attendue.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="carte">
        <h2 style={{ fontSize: "var(--adsum-text-lg)", marginBottom: 4 }}>3. Les domaines de cette organisation</h2>
        <p className="muted small" style={{ margin: "0 0 10px" }}>
          Le domaine décide à quelle base une requête s&apos;adresse. Un domaine ne sert
          qu&apos;une organisation.
        </p>

        {hotes.length === 0 ? (
          <p className="bandeau bandeau-info">
            Aucun domaine rattaché. Tant qu&apos;aucun domaine ne l&apos;est pour aucune
            organisation, la plateforme reste en mode transition et sert la base
            historique. <strong>Le premier domaine enregistré met fin à cette
            transition</strong> : tout domaine non rattaché sera alors refusé, y compris
            ceux qui fonctionnaient.
          </p>
        ) : (
          <div className="file" style={{ marginBottom: 12 }}>
            {hotes.map((h) => (
              <div key={h.id} className="fil fil-normale" style={{ cursor: "default" }}>
                <span className="fil-bande" aria-hidden="true" />
                <span className="fil-corps">
                  <span className="fil-sujet mono">{h.hote}</span>
                  <span className="fil-meta">
                    {h.base_propre ? "Base dédiée" : "Base historique"}
                    {h.note ? ` · ${h.note}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="barre" style={{ marginBottom: 0 }}>
          <input
            className="champ champ-large"
            placeholder="exemple : paroisse-saint-jean.adsum.app"
            value={nouvelHote}
            onChange={(e) => setNouvelHote(e.target.value)}
          />
          <button
            type="button"
            className="bouton bouton-discret"
            disabled={busy || nouvelHote.trim().length < 3}
            onClick={() =>
              void agir(async () => {
                const r = await rattacherHote(token, organisation.id, nouvelHote.trim(), dsn.trim());
                setHotes(await getHotes(token, organisation.id));
                setNouvelHote("");
                if (r.avertissement) setErreur(r.avertissement);
              }, "Domaine rattaché.")
            }
          >
            Rattacher ce domaine
          </button>
        </div>
      </div>

      <div className="carte">
        <h2 style={{ fontSize: "var(--adsum-text-lg)", marginBottom: 4 }}>4. Les modules souscrits</h2>
        <p className="muted small" style={{ margin: "0 0 10px" }}>
          Un module non souscrit n&apos;est pas seulement masqué : son API refuse
          l&apos;accès. Ne rien cocher laisse tout le catalogue accessible, ce qui est
          l&apos;état de transition.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8, marginBottom: 12 }}>
          {catalogue.map((m) => (
            <label key={m.code} className="case" style={{ alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={choisis.has(m.code)}
                onChange={(e) => {
                  const suite = new Set(choisis);
                  if (e.target.checked) suite.add(m.code);
                  else suite.delete(m.code);
                  setChoisis(suite);
                }}
              />
              <span>
                <strong style={{ fontSize: 13 }}>{m.nom}</strong>
                <br />
                <span className="muted small">{m.description ?? m.code}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="barre" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className="bouton"
            disabled={busy || choisis.size === 0}
            onClick={() =>
              void agir(
                () => definirModules(token, organisation.id, [...choisis]),
                `${choisis.size} module(s) enregistré(s). Les autres sont désormais refusés pour cette organisation.`,
              )
            }
          >
            Enregistrer les {choisis.size} module(s)
          </button>
          <span className="small muted">
            Le contrat s&apos;écrit d&apos;un bloc : ce qui n&apos;est pas coché est retiré.
          </span>
        </div>
      </div>
    </section>
  );
}
