import { useEffect, useState } from "react";

import { aAccesConsole, getSynthese, type Session } from "./api.js";
import { Connexion } from "./components/Connexion.js";
import { Conversation } from "./components/Conversation.js";
import { Envois } from "./components/Envois.js";
import { FileSupport } from "./components/FileSupport.js";
import { Organisations } from "./components/Organisations.js";

type Page = "support" | "envois" | "organisations";

const CLE_SESSION = "adsum.console.session";

/**
 * The publisher's console.
 *
 * Not the back office. The back office belongs to the client organisation and manages
 * its members; this belongs to the publisher and watches the platform across
 * organisations. Keeping them apart is not a preference: an operator handling several
 * clients must never be one wrong click away from a member's file, and a client
 * administrator must never see another organisation's incidents.
 *
 * Authorisation is asked of the server, not read from the token. A client that decides
 * for itself eventually disagrees with the API and shows screens whose every action is
 * then refused.
 */
export function App(): JSX.Element {
  const [session, setSession] = useState<Session | null>(() => lireSession());
  const [autorise, setAutorise] = useState<boolean | null>(null);
  const [page, setPage] = useState<Page>("support");
  const [filOuvert, setFilOuvert] = useState<string | null>(null);
  const [ouverts, setOuverts] = useState<number>(0);

  useEffect(() => {
    if (!session) {
      setAutorise(null);
      return;
    }
    let vivant = true;
    void aAccesConsole(session.token).then((ok) => {
      if (vivant) setAutorise(ok);
    });
    return () => {
      vivant = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session || autorise !== true) return;
    let vivant = true;
    const rafraichir = (): void => {
      void getSynthese(session.token)
        .then((s) => {
          if (vivant) setOuverts(s.ouverts);
        })
        .catch(() => undefined);
    };
    rafraichir();
    // A queue is watched, not opened once. Thirty seconds is frequent enough for a
    // person to notice a new request without turning the screen into a poller.
    const minuteur = window.setInterval(rafraichir, 30_000);
    return () => {
      vivant = false;
      window.clearInterval(minuteur);
    };
  }, [session, autorise, filOuvert]);

  function ouvrirSession(s: Session): void {
    setSession(s);
    try {
      sessionStorage.setItem(CLE_SESSION, JSON.stringify(s));
    } catch {
      // A browser refusing storage still gets a working session for this tab.
    }
  }

  function fermerSession(): void {
    setSession(null);
    setAutorise(null);
    setFilOuvert(null);
    try {
      sessionStorage.removeItem(CLE_SESSION);
    } catch {
      // Nothing to clear.
    }
  }

  if (!session) return <Connexion onSession={ouvrirSession} />;

  if (autorise === false) {
    return (
      <div className="connexion">
        <div className="connexion-carte">
          <h1>Accès refusé</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Ce compte existe mais n&apos;a pas la permission de traiter le support. Elle
            se donne depuis le back-office, dans la gestion des rôles.
          </p>
          <button type="button" className="bouton" onClick={fermerSession}>
            Changer de compte
          </button>
        </div>
      </div>
    );
  }

  if (autorise === null) {
    return (
      <div className="connexion">
        <div className="connexion-carte">
          <p className="muted small" style={{ margin: 0 }}>Vérification de vos accès...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cadre">
      <nav className="rail">
        <div className="rail-marque">
          <strong>Console</strong>
          <span>Éditeur ADSUM</span>
        </div>
        <button
          type="button"
          className={`rail-lien${page === "support" ? " actif" : ""}`}
          onClick={() => {
            setPage("support");
            setFilOuvert(null);
          }}
        >
          <span>Support</span>
          {ouverts > 0 && <span className="rail-compte">{ouverts}</span>}
        </button>
        <button
          type="button"
          className={`rail-lien${page === "envois" ? " actif" : ""}`}
          onClick={() => {
            setPage("envois");
            setFilOuvert(null);
          }}
        >
          <span>Santé des envois</span>
        </button>
        <button
          type="button"
          className={`rail-lien${page === "organisations" ? " actif" : ""}`}
          onClick={() => {
            setPage("organisations");
            setFilOuvert(null);
          }}
        >
          <span>Organisations</span>
        </button>
        <div className="rail-pied">
          <span>{session.role}</span>
          <button type="button" className="rail-lien" onClick={fermerSession}>
            <span>Se déconnecter</span>
          </button>
        </div>
      </nav>

      <main className="contenu">
        {filOuvert ? (
          <Conversation token={session.token} filId={filOuvert} onRetour={() => setFilOuvert(null)} />
        ) : page === "envois" ? (
          <Envois token={session.token} />
        ) : page === "organisations" ? (
          <Organisations token={session.token} />
        ) : (
          <FileSupport token={session.token} onOuvrir={setFilOuvert} />
        )}
      </main>
    </div>
  );
}

/**
 * The session lives in sessionStorage, not localStorage.
 *
 * The console is opened on shared machines by people on shift. A token that survives
 * closing the browser survives the shift, and the next person inherits it.
 */
function lireSession(): Session | null {
  try {
    const brut = sessionStorage.getItem(CLE_SESSION);
    if (!brut) return null;
    const s = JSON.parse(brut) as Session;
    return s.token ? s : null;
  } catch {
    return null;
  }
}
