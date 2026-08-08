import { useState } from "react";

import { getFile, getSynthese, type FilSupport, type StatutFil } from "../api.js";
import { useResource } from "../useResource.js";

const LIBELLE_STATUT: Record<StatutFil, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  en_attente: "En attente",
  resolu: "Résolu",
  clos: "Clos",
};

const TAILLES = [10, 20, 50, 100];

/**
 * The queue.
 *
 * Ordered by last activity rather than by creation, because a thread nobody has
 * touched for a week matters more than one opened an hour ago and already answered.
 *
 * The summary above it leads with what is wrong rather than with a total: the number
 * never answered, the oldest wait, the answers that failed to send. An average
 * response time would hide the one request that has been waiting three weeks, and
 * that is the request that costs an organisation its trust.
 */
export function FileSupport({
  token,
  onOuvrir,
}: {
  token: string;
  onOuvrir: (id: string) => void;
}): JSX.Element {
  const [statut, setStatut] = useState("ouverts");
  const [assigne, setAssigne] = useState("");
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [decalage, setDecalage] = useState(0);
  const [limite, setLimite] = useState(20);

  const synthese = useResource(() => getSynthese(token), [token]);
  const file = useResource(
    () => getFile(token, { statut, assigne, recherche, decalage, limite }),
    [token, statut, assigne, recherche, decalage, limite],
  );

  const s = synthese.data;
  const d = file.data;
  const total = d?.total ?? 0;
  const page = Math.floor(decalage / limite) + 1;
  const pages = Math.max(1, Math.ceil(total / limite));

  return (
    <section>
      <header className="tete">
        <h1>Demandes de support</h1>
        <p>
          Les demandes des membres et des administrateurs, quelle qu&apos;en soit
          l&apos;origine. Une réponse par courriel revient dans le fil qu&apos;elle
          concerne.
        </p>
      </header>

      {synthese.error && <p className="bandeau bandeau-erreur">{synthese.error}</p>}

      {s && (
        <div className="indicateurs">
          <Indicateur libelle="Demandes ouvertes" valeur={s.ouverts} />
          <Indicateur
            libelle="Jamais répondues"
            valeur={s.jamais_repondus}
            ton={s.jamais_repondus > 0 ? "attention" : undefined}
          />
          <Indicateur
            libelle="Plus longue attente"
            valeur={s.plus_ancienne_attente_heures > 48
              ? `${Math.round(s.plus_ancienne_attente_heures / 24)} j`
              : `${s.plus_ancienne_attente_heures} h`}
            ton={s.plus_ancienne_attente_heures > 48 ? "alerte" : undefined}
          />
          <Indicateur
            libelle="Sans responsable"
            valeur={s.non_assignes}
            ton={s.non_assignes > 0 ? "attention" : undefined}
          />
          <Indicateur
            libelle="Réponses non parties"
            valeur={s.reponses_non_parties}
            ton={s.reponses_non_parties > 0 ? "alerte" : undefined}
          />
        </div>
      )}

      {s && s.reponses_non_parties > 0 && (
        <p className="bandeau bandeau-erreur">
          {s.reponses_non_parties} réponse(s) écrite(s) mais jamais remise(s). Le
          demandeur attend toujours. Vérifiez le fournisseur d&apos;envoi.
        </p>
      )}

      <div className="barre">
        <select className="champ" value={statut} onChange={(e) => { setStatut(e.target.value); setDecalage(0); }}>
          <option value="ouverts">Ouvertes</option>
          <option value="tous">Toutes</option>
          <option value="nouveau">Nouvelles</option>
          <option value="en_cours">En cours</option>
          <option value="en_attente">En attente</option>
          <option value="resolu">Résolues</option>
          <option value="clos">Closes</option>
        </select>
        <select className="champ" value={assigne} onChange={(e) => { setAssigne(e.target.value); setDecalage(0); }}>
          <option value="">Tout responsable</option>
          <option value="moi">Les miennes</option>
          <option value="personne">Sans responsable</option>
        </select>
        <input
          className="champ champ-large"
          placeholder="Référence, sujet ou adresse"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setRecherche(saisie);
              setDecalage(0);
            }
          }}
        />
        <button type="button" className="bouton bouton-discret" onClick={() => { setRecherche(saisie); setDecalage(0); }}>
          Rechercher
        </button>
        {recherche && (
          <button type="button" className="bouton bouton-discret" onClick={() => { setSaisie(""); setRecherche(""); setDecalage(0); }}>
            Effacer
          </button>
        )}
      </div>

      {file.error && <p className="bandeau bandeau-erreur">{file.error}</p>}

      {file.loading && <p className="vide">Chargement...</p>}

      {!file.loading && (d?.fils ?? []).length === 0 && (
        <p className="vide">
          {recherche || statut !== "ouverts" || assigne
            ? "Aucune demande ne correspond à ces filtres."
            : "Aucune demande ouverte. Rien n'attend de réponse."}
        </p>
      )}

      <div className="file">
        {(d?.fils ?? []).map((f) => (
          <LigneFil key={f.id} fil={f} onOuvrir={() => onOuvrir(f.id)} />
        ))}
      </div>

      {total > 0 && (
        <div className="pagination">
          <label className="case">
            <span>Afficher</span>
            <select
              className="champ"
              value={limite}
              onChange={(e) => { setLimite(Number(e.target.value)); setDecalage(0); }}
            >
              {TAILLES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>par page</span>
          </label>
          <span className="mono">
            {decalage + 1} à {Math.min(decalage + limite, total)} sur {total}
          </span>
          <div className="pagination-boutons">
            <button
              type="button"
              className="bouton bouton-discret"
              disabled={page <= 1}
              onClick={() => setDecalage(Math.max(0, decalage - limite))}
            >
              Précédent
            </button>
            <span className="mono">Page {page} sur {pages}</span>
            <button
              type="button"
              className="bouton bouton-discret"
              disabled={page >= pages}
              onClick={() => setDecalage(decalage + limite)}
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Indicateur({
  libelle,
  valeur,
  ton,
}: {
  libelle: string;
  valeur: number | string;
  ton?: "alerte" | "attention";
}): JSX.Element {
  return (
    <div className={`indicateur${ton ? ` indicateur-${ton}` : ""}`}>
      <span className="indicateur-valeur">{valeur}</span>
      <span className="indicateur-libelle">{libelle}</span>
    </div>
  );
}

function LigneFil({ fil, onOuvrir }: { fil: FilSupport; onOuvrir: () => void }): JSX.Element {
  const attente = fil.derniere_reponse_le ? null : depuis(fil.cree_le);
  return (
    <button type="button" className={`fil fil-${fil.priorite}`} onClick={onOuvrir}>
      <span className="fil-bande" aria-hidden="true" />
      <span className="fil-corps">
        <span className="fil-sujet">{fil.sujet}</span>
        <span className="fil-meta mono">
          {fil.reference}
          {" · "}
          {fil.demandeur_nom || fil.demandeur_email}
          {fil.canal === "email" ? " · reçue par courriel" : ""}
          {attente ? ` · sans réponse depuis ${attente}` : ""}
          {fil.assigne_nom ? ` · ${fil.assigne_nom}` : " · sans responsable"}
        </span>
      </span>
      <span className="fil-droite">
        <span className={`pastille pastille-${fil.statut}`}>{LIBELLE_STATUT[fil.statut]}</span>
      </span>
    </button>
  );
}

/** How long ago, in the coarsest unit that is still informative. */
function depuis(iso: string | null): string {
  if (!iso) return "";
  const heures = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (heures < 1) return "moins d'une heure";
  if (heures < 48) return `${heures} h`;
  return `${Math.floor(heures / 24)} jours`;
}
