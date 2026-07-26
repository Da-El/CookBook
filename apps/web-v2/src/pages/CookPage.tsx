import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { v2, type CookingSession, type Recipe } from "../lib/api";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CookPage() {
  const { id = "" } = useParams();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [session, setSession] = useState<CookingSession | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await v2.getRecipe(id);
        setRecipe(r);
        const s = await v2.startCook(r.id);
        setSession(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, [id]);

  // Client-side countdown for running timers
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const displayTimers = useMemo(() => {
    if (!session) return [];
    return session.timers.map((tm) => {
      // optimistic local remaining when running
      void tick;
      return tm;
    });
  }, [session, tick]);

  useEffect(() => {
    if (!session) return;
    const anyRunning = session.timers.some((t) => t.running && t.remaining_seconds > 0);
    if (!anyRunning) return;
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        timers: prev.timers.map((t) =>
          t.running && t.remaining_seconds > 0
            ? { ...t, remaining_seconds: t.remaining_seconds - 1 }
            : t.remaining_seconds === 0
              ? { ...t, running: false }
              : t,
        ),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick drives countdown
  }, [tick]);

  async function act(timerId: string, action: string) {
    if (!session) return;
    const updated = await v2.timerAction(session.id, { timer_id: timerId, action });
    setSession(updated);
  }

  if (error) return <p className="error">{error}</p>;
  if (!recipe || !session) return <p className="muted">Starting cook mode…</p>;

  return (
    <div>
      <p className="muted">
        <Link to={`/recipes/${recipe.id}`}>← {recipe.title}</Link>
      </p>
      <h1 style={{ marginTop: 8 }}>Cook mode</h1>
      <p className="lede">Step-by-step + multiple timers (client countdown; session stored on V2 API).</p>

      <section style={{ marginTop: 18 }}>
        <h2>Timers</h2>
        <div className="timer-grid" style={{ marginTop: 10 }}>
          {displayTimers.map((t) => (
            <div key={t.id} className="timer-card">
              <div className="muted">{t.label}</div>
              <div className="time">{fmt(t.remaining_seconds)}</div>
              <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => act(t.id, "start")}>
                  Start
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => act(t.id, "pause")}>
                  Pause
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => act(t.id, "reset")}>
                  Reset
                </button>
              </div>
            </div>
          ))}
          {displayTimers.length === 0 && <p className="muted">No timers on this recipe.</p>}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Steps</h2>
        <ol className="steps" style={{ marginTop: 12 }}>
          {recipe.steps.map((s) => (
            <li key={s.id}>
              {s.instruction}
              {s.beginner_note && (
                <p className="muted" style={{ marginTop: 6 }}>
                  {s.beginner_note}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
