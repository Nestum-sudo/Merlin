"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./Onboarding.module.css";

type Step = "account" | "garmin" | "connectingGarmin" | "done";

interface Props {
  initialStep: Step;
  initialUserId: string | null;
  stravaCancelled: boolean;
}

export default function OnboardingView({ initialStep, initialUserId, stravaCancelled }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [starting, setStarting] = useState(false);
  const [garminSkipped, setGarminSkipped] = useState(false);
  const [garminEmail, setGarminEmail] = useState("");
  const [garminPassword, setGarminPassword] = useState("");
  const [garminConsent, setGarminConsent] = useState(false);
  const [garminError, setGarminError] = useState<string | null>(null);

  const checkpointIndex = step === "account" ? 1 : step === "done" ? 3 : 2;

  // "Continuar com Strava" — cria o utilizador (ainda sem sessão real, ver
  // TODO em /api/users) e sai logo para a página de autorização real do
  // Strava. Não há ecrã de permissões nosso: quem mostra isso é o Strava.
  async function handleStartStrava() {
    setStarting(true);
    const id = userId ?? (await createUser());
    window.location.href = `/api/strava/authorize?userId=${id}`;
  }

  async function handleEmailContinue() {
    if (!email) return;
    setStarting(true);
    const id = await createUser(email);
    setUserId(id);
    window.location.href = `/api/strava/authorize?userId=${id}`;
  }

  async function createUser(emailValue?: string): Promise<string> {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailValue ? { email: emailValue } : {}),
    });
    const json = await res.json();
    return json.userId;
  }

  async function handleConnectGarmin() {
    if (!userId) return;
    setGarminError(null);
    setStep("connectingGarmin");
    try {
      const res = await fetch("/api/garmin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: garminEmail, password: garminPassword }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "falha a ligar o Garmin");
      setStep("done");
    } catch (err) {
      setGarminError(String(err));
      setStep("garmin");
    }
  }

  function handleSkipGarmin() {
    setGarminSkipped(true);
    setStep("done");
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
          <Checkpoint label="Strava" active={checkpointIndex === 2} done={checkpointIndex > 2} />
          <div className={styles.cpLine}><i style={{ width: checkpointIndex > 2 ? "100%" : "0%" }} /></div>
          <Checkpoint label="Garmin" active={checkpointIndex === 3 && step !== "done"} done={step === "done"} />
        </div>

        <div className={styles.hud}>
          <div className={styles.card}>
            {step === "account" && (
              <>
                <div className={styles.eyebrow}>Bem-vindo</div>
                <h1 className={styles.h1}>O teu treino,<br />num só sítio.</h1>
                <p className={styles.sub}>Junta os dados do Strava e do Garmin e deixa o Merlin cuidar do plano — tu só pedalas.</p>

                {stravaCancelled && <p className={styles.errorNote}>A autorização do Strava foi cancelada — tenta outra vez quando quiseres.</p>}

                <div className={styles.btnRow}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={starting} onClick={handleStartStrava}>
                    Continuar com Strava
                  </button>
                  <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setShowEmailForm(true)}>
                    Continuar com email
                  </button>
                </div>

                {showEmailForm && (
                  <div style={{ marginTop: 20 }}>
                    <div className={styles.field}>
                      <label>EMAIL</label>
                      <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@exemplo.com" />
                    </div>
                    <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={starting || !email} onClick={handleEmailContinue}>
                      Criar conta
                    </button>
                  </div>
                )}

                <p className={styles.sub} style={{ marginTop: 14, marginBottom: 0, fontSize: 11 }}>
                  Ao continuar, vamos precisar de ligar o Strava a seguir para importar as tuas atividades.
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
                  <button className={styles.btnGhost} onClick={handleSkipGarmin}>
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

            {step === "done" && (
              <>
                <div className={styles.eyebrow}>Tudo pronto</div>
                <h1 className={styles.h1}>Contas ligadas.</h1>
                <p className={styles.sub}>Já temos dados suficientes para calcular a tua primeira prontidão.</p>

                <div className={`${styles.doneRow} ${styles.ok}`}>
                  <div className={styles.doneRowStat}>✓</div>
                  <div className={styles.doneRowTxt}><b>Strava</b><span>Ligado e sincronizado</span></div>
                </div>
                <div className={`${styles.doneRow} ${garminSkipped ? styles.pending : styles.ok}`}>
                  <div className={styles.doneRowStat}>{garminSkipped ? "—" : "✓"}</div>
                  <div className={styles.doneRowTxt}>
                    <b>Garmin Connect</b>
                    <span>{garminSkipped ? "Por ligar — podes fazê-lo nas Definições" : "Ligado e a sincronizar"}</span>
                  </div>
                </div>

                <div className={styles.btnRow}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => router.push("/")}>
                    Ver o meu painel
                  </button>
                </div>
              </>
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
