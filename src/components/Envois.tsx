import { useState } from "react";

import { getDestinatairesEnEchec, getSanteEnvois } from "../api.js";
import { useResource } from "../useResource.js";

const FENETRES = [7, 30, 90];

/**
 * Whether the platform is delivering, and what is stopping it.
 *
 * The journal had been filling for weeks with nobody reading it, so the only way a
 * broken delivery surfaced was a member saying they had received nothing.
 *
 * The headline rate excludes reserved domains on purpose, and says how many it
 * excluded. A seeded base shows a catastrophic figure that describes the seed rather
 * than the platform, and an operator who learns to ignore a red number will ignore it
 * the day it is real. Hiding those failures entirely would be the opposite mistake.
 */
export function Envois({ token }: { token: string }): JSX.Element {
  const [jours, setJours] = useState(30);
  const sante = useResource(() => getSanteEnvois(token, jours), [token, jours]);
  const destinataires = useResource(() => getDestinatairesEnEchec(token, jours), [token, jours]);

  const d = sante.data;
  const grave = (d?.taux_echec ?? 0) >= 10;

  return (
    <section>
      <header className="tete">
        <h1>Santé des envois</h1>
        <p>
          Ce que la plateforme parvient, ou ne parvient pas, à remettre. Une adresse qui
          échoue à répétition a cessé d&apos;être joignable : la renvoyer n&apos;y change
          rien, il faut la corriger.
        </p>
      </header>

      <div className="barre">
        {FENETRES.map((n) => (
          <button
            key={n}
            type="button"
            className={`bouton ${jours === n ? "" : "bouton-discret"}`}
            onClick={() => setJours(n)}
          >
            {n} jours
          </button>
        ))}
      </div>

      {sante.error && <p className="bandeau bandeau-erreur">{sante.error}</p>}
      {sante.loading && <p className="vide">Chargement...</p>}

      {d && (
        <>
          <div className="indicateurs">
            <div className={`indicateur${grave ? " indicateur-alerte" : ""}`}>
              <span className="indicateur-valeur">{d.taux_echec} %</span>
              <span className="indicateur-libelle">Taux d&apos;échec réel</span>
            </div>
            <div className="indicateur">
              <span className="indicateur-valeur">{d.succes}</span>
              <span className="indicateur-libelle">Messages remis</span>
            </div>
            <div className={`indicateur${d.echecs_reels > 0 ? " indicateur-attention" : ""}`}>
              <span className="indicateur-valeur">{d.echecs_reels}</span>
              <span className="indicateur-libelle">Échecs sur adresses réelles</span>
            </div>
            <div className="indicateur">
              <span className="indicateur-valeur">{d.en_vol}</span>
              <span className="indicateur-libelle">Sans retour du fournisseur</span>
            </div>
          </div>

          {d.echecs_adresses_fictives > 0 && (
            <p className="bandeau bandeau-info">
              {d.echecs_adresses_fictives} échec(s) visent des adresses de démonstration
              (<span className="mono">example.com</span> et assimilées), qui ne peuvent rien
              recevoir. Ils sont comptés ici mais retirés du taux, sinon le chiffre
              décrirait le jeu de démonstration et non la plateforme.
            </p>
          )}

          <div className="carte">
            <h2 style={{ fontSize: "var(--adsum-text-lg)", marginBottom: 10 }}>Pourquoi cela échoue</h2>
            {d.motifs.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>Aucun échec sur la période.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                {d.motifs.map((m) => (
                  <li key={m.motif} style={{ fontSize: "var(--adsum-text-sm)" }}>
                    <span className="mono" style={{ fontWeight: 700 }}>{m.n}</span> - {m.motif}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="carte">
            <h2 style={{ fontSize: "var(--adsum-text-lg)", marginBottom: 4 }}>Par domaine</h2>
            <p className="muted small" style={{ margin: "0 0 10px" }}>
              Un fournisseur qui refuse tout est un seul problème, pas quarante.
            </p>
            {d.domaines.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>Aucun échec sur la période.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                {d.domaines.map((x) => (
                  <li key={x.domaine} style={{ fontSize: "var(--adsum-text-sm)" }}>
                    <span className="mono" style={{ fontWeight: 700 }}>{x.echecs}</span> échec(s) sur{" "}
                    <span className="mono">{x.adresses}</span> adresse(s) - <span className="mono">{x.domaine}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {destinataires.data && (
        <div className="carte">
          <h2 style={{ fontSize: "var(--adsum-text-lg)", marginBottom: 4 }}>
            Destinataires en échec ({destinataires.data.total})
          </h2>
          <p className="muted small" style={{ margin: "0 0 10px" }}>{destinataires.data.note}</p>
          {destinataires.data.destinataires.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>Aucun destinataire en échec.</p>
          ) : (
            <div className="file">
              {destinataires.data.destinataires.map((x) => (
                <div key={x.adresse} className="fil fil-normale" style={{ cursor: "default" }}>
                  <span className="fil-bande" aria-hidden="true" />
                  <span className="fil-corps">
                    <span className="fil-sujet mono">{x.adresse}</span>
                    <span className="fil-meta">{x.motif}</span>
                  </span>
                  <span className="fil-droite">
                    <span className="pastille pastille-en_cours mono">{x.echecs} échecs</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
