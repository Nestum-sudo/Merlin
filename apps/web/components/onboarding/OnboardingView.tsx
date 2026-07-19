"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "./Onboarding.module.css";

type Step = "account" | "garmin" | "connectingGarmin";

interface Props {
  step: Step;
  stravaCancelled: boolean;
}

export default function OnboardingView({ step: initialStep, stravaCancelled }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [garminEmail, setGarminEmail] = useState("");
  const [garminPassword, setGarminPassword] = useState("");
  const [garminConsent, setGarminConsent] = useState(false);
  const [garminError, setGarminError] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);

  const checkpointIndex = step === "account" ? 1 : 3;

  async function handleConnectGarmin() {
    setGarminError(null);
    setStep("connectingGarmin");
    try {
      const res = await fetch("/api/garmin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: garminEmail, password: garminPassword }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "falha a ligar o Garmin");
      router.push("/");
    } catch (err) {
      setGarminError(String(err));
      setStep("garmin");
    }
  }

  async function handleSkipGarmin() {
    setSkipping(true);
    await fetch("/api/garmin/skip", { method: "POST" });
    router.push("/");
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.brand}>
          <div className={styles.brandMark} />
          <div className={styles.brandName}>MER<span>LIN</span></div>
        </div>

        <div className={styles.checkpoints}>
          <Checkpoint label="Conta" active={checkpointIndex === 1} done={checkpointIndex > 1} />
          <div className={styles.cpLine}><i style={{ width: checkpointIndex > 1 ? "100%" : "0%" }} /></div>
          <Checkpoint label="Strava" active={false} done={checkpointIndex > 1} />
          <div className={styles.cpLine}><i style={{ width: checkpointIndex > 1 ? "100%" : "0%" }} /></div>
          <Checkpoint label="Garmin" active={checkpointIndex === 3} done={false} />
        </div>

        <div className={styles.hud}>
          <div className={styles.card}>
            {step === "account" && (
              <>
                <div className={styles.eyebrow}>Bem-vindo</div>
                <h1 className={styles.h1}>O teu treino,<br />num só sítio.</h1>
                <p className={styles.sub}>
                  Junta os dados do Strava e do Garmin e deixa o Merlin cuidar do plano — tu só pedalas.
                  A tua conta Strava é também a tua conta Merlin.
                </p>

                {stravaCancelled && (
                  <p className={styles.errorNote}>A autorização do Strava foi cancelada — tenta outra vez quando quiseres.</p>
                )}

                <div className={styles.btnRow}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => signIn("strava", { callbackUrl: "/onboarding" })}>
                    Continuar com Strava
                  </button>
                </div>

                <p className={styles.sub} style={{ marginTop: 14, marginBottom: 0, fontSize: 11 }}>
                  Vais sair para o Strava para autorizar o acesso — voltas aqui logo a seguir.
                </p>
              </>
            )}

            {step === "garmin" && (
              <>
                <div className={styles.serviceRow}>
                  <div className={`${styles.serviceIcon} ${styles.serviceIconGarmin}`}>G</div>
                  <div>
                    <div className={styles.serviceName}>Garmin Connect</div>
                    <div className={styles.serviceTag}>SONO · HRV · RECUPERAÇÃO</div>
                  </div>
                </div>
                <h1 className={styles.h1Small}>Liga o Garmin para veres a prontidão</h1>
                <p className={styles.sub} style={{ marginBottom: 16, marginTop: 10 }}>
                  O Garmin ainda não tem uma ligação direta como o Strava. Por isso pedimos as tuas credenciais só para sincronizar sono e recuperação — nunca para mais nada.
                </p>

                {garminError && <p className={styles.errorNote}>{garminError}</p>}

                <div className={styles.field}><label>EMAIL GARMIN</label><input type="text" value={garminEmail} onChange={(e) => setGarminEmail(e.target.value)} /></div>
                <div className={styles.field}><label>PALAVRA-PASSE</label><input type="password" value={garminPassword} onChange={(e) => setGarminPassword(e.target.value)} /></div>

                <div className={styles.assureRow}>
                  <div className={styles.assure}><div className={styles.assureIc}>✓</div>Encriptado em trânsito e em repouso</div>
                  <div className={styles.assure}><div className={styles.assureIc}>✓</div>Só leitura</div>
                  <div className={styles.assure}><div className={styles.assureIc}>✓</div>Nunca partilhado com terceiros</div>
                </div>

                <div className={styles.checkRow}>
                  <input type="checkbox" id="garminConsent" checked={garminConsent} onChange={(e) => setGarminConsent(e.target.checked)} />
                  <label htmlFor="garminConsent">Autorizo o Merlin a sincronizar os meus dados de sono e recuperação do Garmin Connect.</label>
                </div>

                <div className={styles.btnRow}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={!garminConsent || !garminEmail || !garminPassword} onClick={handleConnectGarmin}>
                    Ligar Garmin
                  </button>
                  <button className={styles.btnGhost} disabled={skipping} onClick={handleSkipGarmin}>
                    Saltar por agora — ligo mais tarde nas definições
                  </button>
                </div>
              </>
            )}

            {step === "connectingGarmin" && (
              <div className={styles.connecting}>
                <div className={styles.spin} />
                <p>A LIGAR AO GARMIN…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Checkpoint({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className={`${styles.cp} ${active ? styles.active : ""} ${done ? styles.done : ""}`}>
      <div className={styles.cpDot} />
      <div className={styles.cpLbl}>{label}</div>
    </div>
  );
}
