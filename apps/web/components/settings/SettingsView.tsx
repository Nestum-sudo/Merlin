"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import styles from "./Settings.module.css";
import type { SettingsData } from "@/lib/settings-data";

type SyncRange = "week" | "month" | "all";
const RANGE_LABEL: Record<SyncRange, string> = { week: "última semana", month: "último mês", all: "desde sempre" };

export default function SettingsView({ data }: { data: SettingsData }) {
  const router = useRouter();

  return (
    <div className={styles.body}>
      <header className={styles.topbar}>
        <button className={styles.back} onClick={() => router.push("/")}>← Painel</button>
        <div className={styles.brand}>
          <div className={styles.brandMark} />
          <div className={styles.brandName}>MER<span>LIN</span></div>
        </div>
        <button className={styles.avatar} onClick={() => signOut({ callbackUrl: "/onboarding" })} title="Terminar sessão">
          {data.profile.name.slice(0, 2).toUpperCase()}
        </button>
      </header>

      <main className={styles.main}>
        <div className={styles.eyebrow}>Conta</div>
        <h1 className={styles.pageTitle}>Definições</h1>
        <p className={styles.pageSub}>Gere as tuas ligações de dados, a forma como calculamos a prontidão, e a tua conta.</p>

        <section>
          <div className={styles.sectionTitle}>Contas ligadas</div>
          <StravaCard data={data.strava} />
          <GarminCard data={data.garmin} />
        </section>

        <section>
          <div className={styles.sectionTitle}>Composição da prontidão</div>
          <ReadinessWeights initial={data.readinessWeights} />
        </section>

        <section>
          <div className={styles.sectionTitle}>Perfil</div>
          <ProfileForm initial={data.profile} weight={data.weight} />
        </section>

        <section>
          <div className={styles.sectionTitle}>Zona de risco</div>
          <DangerZone />
        </section>
      </main>
    </div>
  );
}

function StravaCard({ data }: { data: SettingsData["strava"] }) {
  const [status, setStatus] = useState(data.status);
  const [lastSyncedAt, setLastSyncedAt] = useState(data.lastSyncedAt);
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(status === "disconnected" || status === null);

  async function runSync(range: SyncRange) {
    setMenuOpen(false);
    setSyncNote(`A sincronizar (${RANGE_LABEL[range]})…`);
    try {
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range }),
      });
      const json = await res.json();
      if (json.ok) {
        setSyncNote(`Sincronizado — ${json.imported} atividades importadas.`);
        setLastSyncedAt(new Date().toISOString());
        setStatus("connected");
      } else {
        setSyncNote(`Falhou: ${json.error}`);
        setStatus("error");
      }
    } catch {
      setSyncNote("Falhou — sem resposta do servidor.");
    }
  }

  async function disconnect() {
    await fetch("/api/connected-accounts/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "strava" }),
    });
    setDisconnected(true);
    setStatus("disconnected");
  }

  if (disconnected) {
    return (
      <div className={`${styles.hud} ${styles.connCard}`}>
        <div className={styles.connTop}>
          <div className={styles.connId}>
            <div className={`${styles.connIcon} ${styles.connIconStrava}`}>S</div>
            <div><div className={styles.connName}>Strava</div><div className={styles.connMeta}>Não ligado</div></div>
          </div>
          <div className={`${styles.statusPill} ${styles.statusOff}`}>Não ligado</div>
        </div>
        <p className={styles.connMeta} style={{ marginTop: 12 }}>Volta a ligar a partir do onboarding, ou fala connosco se precisares de ajuda.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.hud} ${styles.connCard}`}>
      <div className={styles.connTop}>
        <div className={styles.connId}>
          <div className={`${styles.connIcon} ${styles.connIconStrava}`}>S</div>
          <div>
            <div className={styles.connName}>Strava</div>
            <div className={styles.connMeta}>
              {data.connectedAt ? `Ligado desde ${formatDate(data.connectedAt)}` : "Ligado"}
              {lastSyncedAt ? ` · última sincronização ${formatRelative(lastSyncedAt)}` : ""}
            </div>
          </div>
        </div>
        <div className={`${styles.statusPill} ${status === "error" ? styles.statusError : styles.statusOk}`}>
          {status === "error" ? "Erro de ligação" : "Ligado"}
        </div>
      </div>

      <div className={styles.connScope}>
        {(data.scope ?? "read,activity:read_all").split(",").map((s) => (
          <div key={s} className={styles.scopeTag}>{s}</div>
        ))}
        <div className={styles.scopeTag}>Só leitura</div>
      </div>

      <div className={styles.connActions}>
        <div className={styles.syncSplit}>
          <button className={`${styles.btn} ${styles.btnOutline} ${styles.syncMain}`} onClick={() => runSync("week")}>Sincronizar agora</button>
          <button className={`${styles.btn} ${styles.btnOutline} ${styles.syncCaret}`} onClick={() => setMenuOpen((v) => !v)}>▾</button>
          <div className={`${styles.syncMenu} ${menuOpen ? styles.syncMenuOpen : ""}`}>
            <button onClick={() => runSync("week")}>Última semana</button>
            <button onClick={() => runSync("month")}>Último mês</button>
            <button onClick={() => runSync("all")}>Desde sempre</button>
          </div>
        </div>
        <button className={styles.btnDangerText} onClick={disconnect}>Desligar Strava</button>
        {syncNote && <div className={styles.syncStatus}>{syncNote}</div>}
      </div>
    </div>
  );
}

function GarminCard({ data }: { data: SettingsData["garmin"] }) {
  const [status, setStatus] = useState(data.status);
  const [lastError, setLastError] = useState(data.lastError);
  const [disconnected, setDisconnected] = useState(status === "disconnected" || status === null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  async function retrySync() {
    setSyncing(true);
    setSyncNote("A sincronizar…");
    try {
      const res = await fetch("/api/garmin/sync", { method: "POST" });
      const json = await res.json();
      setSyncNote(json.ok ? "Pedido de sincronização enviado." : `Falhou: ${json.error ?? "erro desconhecido"}`);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    await fetch("/api/connected-accounts/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "garmin" }),
    });
    setDisconnected(true);
    setStatus("disconnected");
  }

  if (disconnected) {
    return (
      <div className={`${styles.hud} ${styles.connCard}`}>
        <div className={styles.connTop}>
          <div className={styles.connId}>
            <div className={`${styles.connIcon} ${styles.connIconGarmin}`}>G</div>
            <div><div className={styles.connName}>Garmin Connect</div><div className={styles.connMeta}>Ainda não ligaste o Garmin</div></div>
          </div>
          <div className={`${styles.statusPill} ${styles.statusOff}`}>Não ligado</div>
        </div>
        <p className={styles.connMeta} style={{ marginTop: 12 }}>Liga a partir do onboarding, ou pede-nos o link direto.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.hud} ${styles.connCard}`}>
      <div className={styles.connTop}>
        <div className={styles.connId}>
          <div className={`${styles.connIcon} ${styles.connIconGarmin}`}>G</div>
          <div>
            <div className={styles.connName}>Garmin Connect</div>
            <div className={styles.connMeta}>
              {status === "error"
                ? `Não conseguimos sincronizar${data.lastSyncedAt ? ` desde ${formatDate(data.lastSyncedAt)}` : ""}`
                : data.lastSyncedAt
                ? `Última sincronização ${formatRelative(data.lastSyncedAt)}`
                : "Ligado"}
            </div>
          </div>
        </div>
        <div className={`${styles.statusPill} ${status === "error" ? styles.statusError : styles.statusOk}`}>
          {status === "error" ? "Erro de ligação" : "Ligado"}
        </div>
      </div>

      {status === "error" && (
        <div className={styles.connErrorBox}>
          <div className={styles.connErrorIc}>!</div>
          <p>{lastError ?? "O Garmin recusou o pedido de sincronização."} O resto da app continua a funcionar normalmente enquanto isto não for resolvido.</p>
        </div>
      )}

      {status !== "error" && (
        <div className={styles.connScope}>
          <div className={styles.scopeTag}>Sono</div>
          <div className={styles.scopeTag}>HRV</div>
          <div className={styles.scopeTag}>Recuperação</div>
          <div className={styles.scopeTag}>Só leitura</div>
        </div>
      )}

      <div className={styles.connActions}>
        <button className={`${styles.btn} ${status === "error" ? styles.btnPrimary : styles.btnOutline}`} disabled={syncing} onClick={retrySync}>
          {status === "error" ? "Ligar novamente" : "Sincronizar agora"}
        </button>
        <button className={styles.btnDangerText} onClick={disconnect}>Desligar Garmin</button>
        {syncNote && <div className={styles.syncStatus}>{syncNote}</div>}
      </div>
    </div>
  );
}

function ReadinessWeights({ initial }: { initial: { sleep: number; recovery: number } }) {
  const [sleep, setSleep] = useState(initial.sleep);
  const [recovery, setRecovery] = useState(initial.recovery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save(newSleep: number, newRecovery: number) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch("/api/settings/readiness-weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sleep: newSleep, recovery: newRecovery }),
      });
    }, 500);
  }

  return (
    <div className={`${styles.hud} ${styles.weightPanel}`}>
      <div className={styles.weightRow}>
        <div className={styles.weightHead}>
          <div className={styles.weightHeadL}><span className={styles.dot} style={{ background: "var(--sky)" }} />Sono</div>
          <div className={styles.weightHeadV}>{sleep}%</div>
        </div>
        <input type="range" min={0} max={100} value={sleep} onChange={(e) => { const v = Number(e.target.value); setSleep(v); save(v, recovery); }} />
      </div>
      <div className={styles.weightRow}>
        <div className={styles.weightHead}>
          <div className={styles.weightHeadL}><span className={styles.dot} style={{ background: "var(--hiviz-dim)" }} />HRV &amp; recuperação</div>
          <div className={styles.weightHeadV}>{recovery}%</div>
        </div>
        <input type="range" min={0} max={100} value={recovery} onChange={(e) => { const v = Number(e.target.value); setRecovery(v); save(sleep, v); }} />
      </div>
      <div className={`${styles.weightRow} ${styles.ghost}`}>
        <div className={styles.weightHead}>
          <div className={styles.weightHeadL}><span className={styles.dot} style={{ background: "var(--chalk-dim)" }} />Nutrição<span className={styles.badge}>EM BREVE</span></div>
          <div className={styles.weightHeadV}>—</div>
        </div>
        <input type="range" min={0} max={100} value={0} disabled />
      </div>
    </div>
  );
}

function ProfileForm({ initial, weight }: { initial: SettingsData["profile"]; weight: SettingsData["weight"] }) {
  const [name, setName] = useState(initial.name);
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth ?? "");
  const [ftp, setFtp] = useState(initial.ftpManualW?.toString() ?? "");
  const [units, setUnits] = useState(initial.unitsPreference);
  const [newWeight, setNewWeight] = useState("");
  const [saved, setSaved] = useState(false);

  const weightDelta = weight.current != null && weight.fourWeeksAgo != null ? weight.current - weight.fourWeeksAgo : null;

  async function saveProfile() {
    await fetch("/api/settings/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, dateOfBirth: dateOfBirth || null, ftpManualW: ftp ? Number(ftp) : null, unitsPreference: units }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveWeight() {
    if (!newWeight) return;
    await fetch("/api/settings/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weightKg: Number(newWeight) }),
    });
    setNewWeight("");
  }

  return (
    <div className={`${styles.hud} ${styles.profilePanel}`}>
      <div className={styles.field}><label>NOME</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className={styles.field}><label>DATA DE NASCIMENTO</label><input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} /></div>

      <div className={styles.field}>
        <label>PESO ATUAL (KG)</label>
        <input type="text" value={newWeight} placeholder={weight.current?.toString() ?? "—"} onChange={(e) => setNewWeight(e.target.value)} onBlur={saveWeight} />
        {weightDelta != null && (
          <div className={styles.weightTrend}>
            <span>{weightDelta > 0 ? "+" : ""}{weightDelta.toFixed(1)} kg nas últimas 4 semanas</span>
          </div>
        )}
      </div>

      <div className={styles.field}><label>FTP MANUAL (W)</label><input type="text" value={ftp} onChange={(e) => setFtp(e.target.value)} /></div>

      <div className={`${styles.field} ${styles.full}`}>
        <label>UNIDADES</label>
        <div className={styles.unitToggle}>
          <button className={units === "metric" ? styles.unitToggleActive : ""} onClick={() => setUnits("metric")}>Métrico (km · kg)</button>
          <button className={units === "imperial" ? styles.unitToggleActive : ""} onClick={() => setUnits("imperial")}>Imperial (mi · lb)</button>
        </div>
      </div>

      <div className={styles.saveBar}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveProfile}>Guardar alterações</button>
        {saved && <span className={styles.saveNote}>Guardado.</span>}
      </div>
    </div>
  );
}

function DangerZone() {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function disconnectAll() {
    await Promise.all(
      ["strava", "garmin"].map((provider) =>
        fetch("/api/connected-accounts/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        })
      )
    );
    window.location.reload();
  }

  async function deleteAccount() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await fetch("/api/account", { method: "DELETE" });
    await signOut({ callbackUrl: "/onboarding" });
  }

  return (
    <div className={`${styles.hud} ${styles.dangerPanel}`}>
      <div className={styles.dangerRow}>
        <div><b>Desligar todas as contas</b><span>Remove o acesso ao Strava e ao Garmin sem apagar o histórico já sincronizado.</span></div>
        <button className={styles.btnDanger} onClick={disconnectAll}>Desligar tudo</button>
      </div>
      <div className={styles.dangerRow}>
        <div><b>Apagar conta</b><span>Remove permanentemente o teu perfil, planos e histórico sincronizado.</span></div>
        <button className={styles.btnDanger} onClick={deleteAccount}>
          {confirmingDelete ? "Confirmar — não há volta atrás" : "Apagar conta"}
        </button>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" });
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.round(hours / 24)} dias`;
}
