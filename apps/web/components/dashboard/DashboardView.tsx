"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./Dashboard.module.css";
import type { DashboardData } from "@/lib/dashboard-data";

const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false });

interface Props {
  userId: string;
  data: DashboardData;
  athleteWeights: { sleep: number; recovery: number };
}

type Tab = "hoje" | "tendencias" | "objetivos";

interface RecalcedSession {
  session_type: string;
  duration_min: number;
  target_zone: string;
  description: string;
}

interface ActivityDetail {
  type: string;
  durationS: number;
  distanceM: number | null;
  elevationGainM: number | null;
  avgPowerW: number | null;
  avgHr: number | null;
  maxHr: number | null;
  hasRoute: boolean;
  route: [number, number][] | null;
  powerSeries: number[];
  hrSeries: number[];
}

export default function DashboardView({ userId, data, athleteWeights }: Props) {
  const [tab, setTab] = useState<Tab>("hoje");

  return (
    <div className={styles.body}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandMark} />
          <div className={styles.brandName}>
            MER<span>LIN</span>
          </div>
        </div>
        <nav className={styles.tabs}>
          {(["hoje", "tendencias", "objetivos"] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? styles.active : ""} onClick={() => setTab(t)}>
              {t === "hoje" ? "Hoje" : t === "tendencias" ? "Tendências" : "Objetivos"}
            </button>
          ))}
        </nav>
        <div className={styles.avatar}>{userId.slice(0, 2).toUpperCase()}</div>
      </header>

      <main className={styles.main}>
        {tab === "hoje" && <HojeTab data={data} athleteWeights={athleteWeights} />}
        {tab === "tendencias" && <TendenciasTab data={data} />}
        {tab === "objetivos" && <ObjetivosTab />}
      </main>
    </div>
  );
}

function HojeTab({ data, athleteWeights }: Omit<Props, "userId">) {
  const { today, week } = data;
  const [sliderMin, setSliderMin] = useState(today.plannedSession?.durationMin ?? 60);
  const [session, setSession] = useState<RecalcedSession | null>(
    today.plannedSession
      ? {
          session_type: today.plannedSession.sessionType,
          duration_min: today.plannedSession.durationMin,
          target_zone: today.plannedSession.targetZone,
          description: today.plannedSession.description,
        }
      : null
  );
  const [recalculating, setRecalculating] = useState(false);
  const [modalActivityId, setModalActivityId] = useState<string | null>(null);
  const debounceHandle = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSliderChange(min: number) {
    setSliderMin(min);
    setRecalculating(true);
    if (debounceHandle.current) clearTimeout(debounceHandle.current);
    debounceHandle.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/plan/recalc-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ availableMinutes: min }),
        });
        const json = await res.json();
        if (json.ok) setSession(json.session);
      } finally {
        setRecalculating(false);
      }
    }, 550);
  }

  const readinessPct = today.readinessScore != null ? today.readinessScore / 100 : 0;
  const circumference = 2 * Math.PI * 64;

  return (
    <>
      <div className={styles.eyebrow}>{formatDateLong(today.date)}</div>
      <h1 className={styles.pageTitle}>A tua sessão de hoje</h1>

      <div className={`${styles.hud} ${styles.recCard}`}>
        <div className={styles.readinessRingWrap}>
          <div className={styles.readinessRing}>
            <svg width="150" height="150" viewBox="0 0 150 150">
              <circle cx="75" cy="75" r="64" fill="none" stroke="#22262B" strokeWidth="10" />
              <circle
                cx="75" cy="75" r="64" fill="none" stroke="#D4FF3F" strokeWidth="10"
                strokeLinecap="square"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - readinessPct)}
              />
            </svg>
            <div className={styles.readinessNum}>
              <div className={styles.n}>{today.readinessScore ?? "—"}</div>
              <div className={styles.u}>PRONTIDÃO</div>
            </div>
          </div>
          <div className={styles.composition}>
            <div className={styles.seg}>
              <div className={styles.lbl}><span>SONO ({athleteWeights.sleep}%)</span><span>{today.sleepScore ?? "—"}</span></div>
              <div className={styles.bar}><i style={{ width: `${today.sleepScore ?? 0}%`, background: "var(--sky)" }} /></div>
            </div>
            <div className={styles.seg}>
              <div className={styles.lbl}><span>HRV/REC. ({athleteWeights.recovery}%)</span><span>{today.recoveryScore ?? "—"}</span></div>
              <div className={styles.bar}><i style={{ width: `${today.recoveryScore ?? 0}%`, background: "var(--hiviz-dim)" }} /></div>
            </div>
            <div className={`${styles.seg} ${styles.ghost}`}>
              <div className={styles.lbl}><span>NUTRIÇÃO</span><span>—</span></div>
              <div className={styles.bar}><i style={{ width: "0%" }} /></div>
            </div>
          </div>
        </div>

        <div className={styles.recMid}>
          <div className={styles.eyebrow}>Recomendação de hoje</div>
          {session ? (
            <>
              <div className={styles.recSession}>
                {sessionLabel(session.session_type)} · <span className={`${styles.dur} mono`}>{session.duration_min} min</span>
              </div>
              <p className={styles.sessOutput}>{session.description}</p>
            </>
          ) : (
            <p className={styles.sessOutput}>Sem plano gerado para hoje ainda — cria um objetivo para começares a receber recomendações.</p>
          )}
          <div className={styles.recWhy} style={{ marginTop: 12 }}>
            <div><span className={`${styles.dot} ${styles.dotSleep}`} /> Sono: {today.sleepScore ?? "sem dados"}</div>
            <div><span className={`${styles.dot} ${styles.dotHrv}`} /> Recuperação: {today.recoveryScore ?? "sem dados"}</div>
            <div><span className={`${styles.dot} ${styles.dotLoad}`} /> TSB atual: {today.tsb ?? "—"}</div>
          </div>
        </div>

        <div className={styles.recAdjust}>
          <label>TEMPO DISPONÍVEL <b>{sliderMin} min</b></label>
          <input type="range" min={30} max={180} step={15} value={sliderMin} onChange={(e) => onSliderChange(Number(e.target.value))} />
          <div className={`${styles.recalcTag} ${recalculating ? styles.show : ""}`}>A RECALCULAR SESSÃO…</div>
        </div>
      </div>

      <div className={styles.stripTitle}>
        <h2>Semana</h2>
        <div className={styles.eyebrow} style={{ margin: 0 }}>CTL {today.ctl ?? "—"}</div>
      </div>
      <div className={styles.weekStrip}>
        {week.map((day) => (
          <button
            key={day.date}
            className={`${styles.dayTile} ${day.isToday ? styles.today : ""} ${day.isDone ? styles.done : ""}`}
            onClick={() => day.activityId && setModalActivityId(day.activityId)}
          >
            <div className={styles.dow}>{day.dow}</div>
            <div className={styles.kind}>{sessionLabel(day.kind)}</div>
            <div className={styles.rbar}><i style={{ width: `${day.readinessPct ?? 0}%` }} /></div>
            <div className={styles.meta}>{day.meta}</div>
          </button>
        ))}
      </div>

      {modalActivityId && <ActivityModal activityId={modalActivityId} onClose={() => setModalActivityId(null)} />}
    </>
  );
}

function ActivityModal({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/activities/${activityId}`)
      .then((r) => r.json())
      .then((json) => {
        setDetail(json);
        setLoading(false);
      });
  }, [activityId]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <h3>{detail ? sessionLabel(detail.type) : "A carregar…"}</h3>
            {detail && (
              <p>
                {Math.round(detail.durationS / 60)} MIN
                {detail.distanceM ? ` · ${(detail.distanceM / 1000).toFixed(1)} KM` : ""}
                {detail.elevationGainM ? ` · ${Math.round(detail.elevationGainM)}M D+` : ""}
              </p>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading && <p className={styles.sessOutput}>A carregar detalhe…</p>}

        {detail && (
          <div className={styles.modalGrid}>
            <div className={`${styles.modalBlock} ${styles.full}`}>
              <h4>CURVA DE POTÊNCIA (SESSÃO)</h4>
              {detail.powerSeries.length > 0 ? (
                <svg width="100%" height="110" viewBox="0 0 700 110" preserveAspectRatio="none">
                  <polyline fill="none" stroke="#C9622B" strokeWidth="2" points={toPolylinePoints(detail.powerSeries, 700, 110)} />
                </svg>
              ) : (
                <p className={styles.sessOutput}>Sem dados de potência para esta sessão.</p>
              )}
            </div>
            <div className={styles.modalBlock}>
              <h4>FREQUÊNCIA CARDÍACA</h4>
              {detail.hrSeries.length > 0 ? (
                <svg width="100%" height="90" viewBox="0 0 300 90" preserveAspectRatio="none">
                  <polyline fill="none" stroke="#4FA8D8" strokeWidth="2" points={toPolylinePoints(detail.hrSeries, 300, 90)} />
                </svg>
              ) : (
                <p className={styles.sessOutput}>Sem stream de FC.</p>
              )}
              <div className={styles.statGrid}>
                <div><div className={styles.v}>{detail.avgHr ?? "—"}</div><div className={styles.l}>FC MÉD.</div></div>
                <div><div className={styles.v}>{detail.maxHr ?? "—"}</div><div className={styles.l}>FC MÁX.</div></div>
                <div><div className={styles.v}>{detail.avgPowerW ?? "—"}</div><div className={styles.l}>POT. MÉD.</div></div>
              </div>
            </div>
            <div className={styles.modalBlock}>
              <h4>ROTA</h4>
              {detail.route && detail.route.length > 0 ? (
                <RouteMap coordinates={detail.route} />
              ) : (
                <p className={styles.sessOutput}>Sem rota GPS para esta sessão.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function toPolylinePoints(series: number[], width: number, height: number): string {
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  return series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function sessionLabel(type: string): string {
  const labels: Record<string, string> = {
    endurance: "Fundo Z2",
    threshold: "Limiar",
    vo2max: "VO2max",
    recovery: "Recuperação",
    rest: "Descanso",
    ride: "Treino",
    virtual_ride: "Rolo",
  };
  return labels[type] ?? type;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "short" });
}

function TendenciasTab({ data }: { data: DashboardData }) {
  const { trend, ctlNow, tsbNow, sleepAvg } = data;

  const { loadPath, loadArea, tsbPath, sleepPath, sleepArea } = useMemo(() => buildElevationPaths(trend), [trend]);

  return (
    <>
      <div className={styles.eyebrow}>Análise de longo prazo</div>
      <h1 className={styles.pageTitle}>Carga e recuperação</h1>

      <div className={`${styles.hud} ${styles.elevationPanel}`}>
        <div className={styles.elevationHead}>
          <div className={styles.legend}>
            <div><span className={`${styles.sw} ${styles.swLoad}`} /> Carga (CTL)</div>
            <div><span className={`${styles.sw} ${styles.swTsb}`} /> Forma (TSB)</div>
            <div><span className={`${styles.sw} ${styles.swSleep}`} /> Sono</div>
          </div>
          <div className={styles.metricsNow}>
            <div><div className={styles.v} style={{ color: "var(--rust)" }}>{ctlNow ?? "—"}</div><div className={styles.l}>CTL</div></div>
            <div><div className={styles.v} style={{ color: "var(--hiviz)" }}>{tsbNow ?? "—"}</div><div className={styles.l}>TSB</div></div>
            <div><div className={styles.v} style={{ color: "var(--sky)" }}>{sleepAvg ?? "—"}</div><div className={styles.l}>SONO MÉD.</div></div>
          </div>
        </div>

        {trend.length > 1 ? (
          <svg className={styles.elevationSvg} viewBox="0 0 1000 320" preserveAspectRatio="none">
            <defs>
              <linearGradient id="loadFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9622B" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#C9622B" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4FA8D8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#4FA8D8" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <g stroke="#2C3136" strokeWidth="1">
              <line x1="0" y1="60" x2="1000" y2="60" />
              <line x1="0" y1="140" x2="1000" y2="140" />
              <line x1="0" y1="220" x2="1000" y2="220" />
              <line x1="0" y1="300" x2="1000" y2="300" />
            </g>
            <path d={loadArea} fill="url(#loadFill)" />
            <path d={loadPath} fill="none" stroke="#C9622B" strokeWidth="2" />
            <path d={tsbPath} fill="none" stroke="#D4FF3F" strokeWidth="2" opacity="0.9" />
            <path d={sleepArea} fill="url(#sleepFill)" />
            <path d={sleepPath} fill="none" stroke="#4FA8D8" strokeWidth="2.5" />
          </svg>
        ) : (
          <p className={styles.sessOutput}>Ainda não há dados suficientes (precisa de pelo menos 2 dias com atividade sincronizada).</p>
        )}
      </div>
    </>
  );
}

// Gera as paths SVG do gráfico-assinatura a partir de dados reais — CTL como
// "terreno" de carga, sono como crista sobreposta, TSB como linha fina.
// Cada série é normalizada dentro da sua própria banda vertical do viewBox
// 1000x320, para as três ficarem legíveis mesmo com escalas diferentes
// (CTL em TSS, sono em 0-100, TSB pode ser negativo).
function buildElevationPaths(trend: DashboardData["trend"]) {
  if (trend.length < 2) return { loadPath: "", loadArea: "", tsbPath: "", sleepPath: "", sleepArea: "" };

  const n = trend.length;
  const x = (i: number) => (i / (n - 1)) * 1000;

  const scale = (values: (number | null)[], bandTop: number, bandBottom: number) => {
    const nums = values.filter((v): v is number => v != null);
    const max = Math.max(...nums, 1);
    const min = Math.min(...nums, 0);
    const range = max - min || 1;
    return (v: number | null) => {
      if (v == null) return (bandTop + bandBottom) / 2;
      return bandBottom - ((v - min) / range) * (bandBottom - bandTop);
    };
  };

  const ctlScale = scale(trend.map((t) => t.ctl), 40, 300);
  const tsbScale = scale(trend.map((t) => t.tsb), 140, 260);
  const sleepScale = scale(trend.map((t) => t.sleepScore), 10, 140);

  const toLine = (yFn: (v: number | null) => number, values: (number | null)[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yFn(v).toFixed(1)}`).join(" ");

  const toArea = (yFn: (v: number | null) => number, values: (number | null)[], baseline: number) =>
    `${toLine(yFn, values)} L${x(n - 1).toFixed(1)},${baseline} L0,${baseline} Z`;

  return {
    loadPath: toLine(ctlScale, trend.map((t) => t.ctl)),
    loadArea: toArea(ctlScale, trend.map((t) => t.ctl), 320),
    tsbPath: toLine(tsbScale, trend.map((t) => t.tsb)),
    sleepPath: toLine(sleepScale, trend.map((t) => t.sleepScore)),
    sleepArea: toArea(sleepScale, trend.map((t) => t.sleepScore), 0),
  };
}

const GOAL_TYPES = [
  { value: "gran_fondo", label: "Gran Fondo" },
  { value: "stage_race", label: "Corrida por etapas" },
  { value: "timed_climb", label: "Subida cronometrada" },
  { value: "base", label: "Base / forma geral" },
];
const PRIORITIES = [
  { value: "climbing_endurance", label: "Resistência de subida" },
  { value: "threshold", label: "Limiar / FTP" },
  { value: "punch", label: "Explosividade" },
];
const HOURS_OPTIONS = [
  { value: 5, label: "4–6h" },
  { value: 7, label: "6–9h" },
  { value: 10, label: "9–12h" },
  { value: 14, label: "12h+" },
];

function ObjetivosTab() {
  const [type, setType] = useState(GOAL_TYPES[0].value);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [priority, setPriority] = useState(PRIORITIES[0].value);
  const [hours, setHours] = useState(HOURS_OPTIONS[1].value);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<{ summary: string; sessions: { date: string; session_type: string; duration_min: number; description: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const goalRes = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, eventName, eventDate: eventDate || null, priority, hoursPerWeekTarget: hours }),
      });
      if (!goalRes.ok) throw new Error("falha a criar o objetivo");

      const planRes = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await planRes.json();
      if (!json.ok) throw new Error(json.error ?? "falha a gerar o plano");
      setPlan(json.plan);
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div className={styles.eyebrow}>Planeamento</div>
      <h1 className={styles.pageTitle}>Define o teu objetivo</h1>

      <div className={`${styles.hud} ${styles.goalPanel}`}>
        <div className={styles.goalForm}>
          <div className={styles.field}>
            <label>TIPO DE OBJETIVO</label>
            <div className={styles.chipRow}>
              {GOAL_TYPES.map((g) => (
                <div key={g.value} className={`${styles.chip} ${type === g.value ? styles.active : ""}`} onClick={() => setType(g.value)}>
                  {g.label}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label>DATA DO EVENTO</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>NOME / LOCAL</label>
            <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="ex. Volta à Serra da Estrela · 140km" />
          </div>
          <div className={styles.field}>
            <label>HORAS DE TREINO POR SEMANA</label>
            <div className={styles.chipRow}>
              {HOURS_OPTIONS.map((h) => (
                <div key={h.value} className={`${styles.chip} ${hours === h.value ? styles.active : ""}`} onClick={() => setHours(h.value)}>
                  {h.label}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label>PRIORIDADE</label>
            <div className={styles.chipRow}>
              {PRIORITIES.map((p) => (
                <div key={p.value} className={`${styles.chip} ${priority === p.value ? styles.active : ""}`} onClick={() => setPriority(p.value)}>
                  {p.label}
                </div>
              ))}
            </div>
          </div>
          <button className={styles.genBtn} disabled={generating} onClick={handleGenerate}>
            {generating ? "A gerar…" : "Gerar plano de treinos"}
          </button>
          {error && <p className={styles.sessOutput} style={{ color: "var(--danger)" }}>{error}</p>}
        </div>

        <div className={styles.planOutput}>
          {!plan && <p className={styles.sessOutput}>O plano gerado aparece aqui.</p>}
          {plan && (
            <>
              <p className={styles.sessOutput} style={{ marginBottom: 10 }}>{plan.summary}</p>
              {plan.sessions.map((s) => (
                <div key={s.date} className={styles.planItem}>
                  <div className={styles.desc}>
                    <b>{sessionLabel(s.session_type)}</b> — {s.description}
                  </div>
                  <div className={styles.tag} style={{ background: "rgba(212,255,63,0.15)", color: "var(--hiviz)" }}>
                    {s.duration_min} min
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
