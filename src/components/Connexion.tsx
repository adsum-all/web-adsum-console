import { useState } from "react";

import { ApiError, login, loginVerify, type Session } from "../api.js";

/**
 * Signing in to the publisher's console.
 *
 * Same accounts and same second factor as the rest of the platform: a separate
 * application must not become a second, weaker way in. What differs is what happens
 * after: the console checks with the server that this account may actually use it,
 * and says so plainly rather than showing empty screens.
 */
export function Connexion({ onSession }: { onSession: (s: Session) => void }): JSX.Element {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState("");
  const [etape, setEtape] = useState<"identifiants" | "code">("identifiants");
  const [canal, setCanal] = useState<string | null>(null);
  const [confiance, setConfiance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(): Promise<void> {
    setBusy(true);
    setErreur(null);
    try {
      if (etape === "identifiants") {
        const r = await login(email.trim(), motDePasse);
        if (r.session) {
          onSession(r.session);
          return;
        }
        if (r.otpRequired) {
          setCanal(r.canal);
          setEtape("code");
          return;
        }
        setErreur("Connexion refusée.");
        return;
      }
      onSession(await loginVerify(email.trim(), motDePasse, code, confiance));
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="connexion">
      <form
        className="connexion-carte"
        onSubmit={(e) => {
          e.preventDefault();
          void soumettre();
        }}
      >
        <div>
          <h1>Console ADSUM</h1>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            Support, observabilité et pilotage des organisations.
          </p>
        </div>

        {erreur && <p className="bandeau bandeau-erreur" style={{ margin: 0 }}>{erreur}</p>}

        {etape === "identifiants" ? (
          <>
            <label className="connexion-champ">
              <span>Adresse de connexion</span>
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="connexion-champ">
              <span>Mot de passe</span>
              <input type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
            </label>
          </>
        ) : (
          <>
            <p className="muted small" style={{ margin: 0 }}>
              {canal === "telegram"
                ? "Un code vient de vous être envoyé sur Telegram."
                : "Un code vient de vous être envoyé par courriel."}
            </p>
            <label className="connexion-champ">
              <span>Code de vérification</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>
            <label className="case">
              <input type="checkbox" checked={confiance} onChange={(e) => setConfiance(e.target.checked)} />
              <span>Se souvenir de cet appareil</span>
            </label>
          </>
        )}

        <button type="submit" className="bouton" disabled={busy}>
          {etape === "identifiants" ? "Se connecter" : "Valider le code"}
        </button>
      </form>
    </div>
  );
}
