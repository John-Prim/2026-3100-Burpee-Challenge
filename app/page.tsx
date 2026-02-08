"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CONTEST_START, CONTEST_END, MONTH_GOAL } from "../lib/contest";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

/* =========================
   Center text plugin
   ========================= */
const centerTextPlugin = {
  id: "centerText",
  beforeDraw(chart: any) {
    const { width, height } = chart;
    const ctx = chart.ctx;

    const text = chart.config.options?.plugins?.centerText?.text;
    if (!text) return;

    ctx.save();

    const fontSize = Math.min(width, height) / 6;
    ctx.font = `bold ${fontSize}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#111";

    ctx.fillText(text, width / 2, height / 2);
    ctx.restore();
  }
};

/* =========================
   Chart.js registration
   ========================= */
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  centerTextPlugin
);

/* =========================
   Types
   ========================= */
type AuditRow = {
  occurred_at: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  actor_name: string;
  target_name: string;
  entry_date: string;
  old_burpees: number | null;
  new_burpees: number | null;
};

type LeaderRow = {
  user_id: string;
  display_name: string;
  total_burpees: number;
};


function colorForIndex(i: number) {
  // Golden-angle hue spacing gives good separation for up to 100+ contestants
  const hue = (i * 137.508) % 360;
  return `hsl(${hue} 70% 50%)`;
}

function borderForIndex(i: number) {
  const hue = (i * 137.508) % 360;
  return `hsl(${hue} 70% 40%)`;
}

function calcStreak(rows: { entry_date: string; burpees: number }[]) {
  const map = new Map<string, number>(
    rows.map((r) => [r.entry_date, Number(r.burpees || 0)])
  );

  const start = new Date("2026-03-01T00:00:00");
  const end = new Date("2026-03-31T00:00:00");

  let cursor = new Date();
  if (cursor > end) cursor = new Date(end);
  if (cursor < start) cursor = new Date(start);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  let s = 0;
  while (cursor >= start && cursor <= end) {
    const key = fmt(cursor);
    const val = map.get(key) ?? 0;
    if (val > 0) s++;
    else break;

    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }

  return s;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);

  const [displayName, setDisplayName] = useState("");
  const [date, setDate] = useState("2026-03-01");
  const [burpees, setBurpees] = useState<number>(0);

  const [myTotal, setMyTotal] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInWithEmail(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert(error.message);
    else alert("Check your email for the login link.");
  }

  async function loadData() {
    if (!session?.user) return;

    setLoading(true);

    const { data: myRows, error: myErr } = await supabase
      .from("burpee_entries")
      .select("entry_date, burpees")
      .gte("entry_date", CONTEST_START)
      .lte("entry_date", CONTEST_END);

    if (myErr) console.error(myErr);
    setMyTotal((myRows ?? []).reduce((sum, r: any) => sum + (r.burpees ?? 0), 0));
    setStreak(calcStreak((myRows ?? []) as any));

    const { data: lb, error: lbErr } = await supabase.rpc("leaderboard_totals", {
      start_date: CONTEST_START,
      end_date: CONTEST_END
    });

    if (lbErr) console.error(lbErr);
    setLeaderboard((lb ?? []).map((r: any) => ({ ...r, total_burpees: Number(r.total_burpees) })));

    const { data: aud, error: audErr } = await supabase
  .from("burpee_audit_public")
  .select("occurred_at, action, actor_name, target_name, entry_date, old_burpees, new_burpees")
  .order("occurred_at", { ascending: false })
  .limit(50);

if (audErr) console.error(audErr);
setAudit((aud ?? []) as any);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function saveDisplayName() {
    if (!session?.user) return;
    const { error } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      display_name: displayName || "Anonymous"
    });
    if (error) alert(error.message);
    await loadData();
  }

  async function submitBurpees() {
    if (!session?.user) return;

    if (date < CONTEST_START || date > CONTEST_END) {
      alert("Date must be within March 1–31, 2026.");
      return;
    }

    const value = Math.max(0, Number(burpees) || 0);

    const { error } = await supabase.from("burpee_entries").upsert({
      user_id: session.user.id,
      entry_date: date,
      burpees: value
    });

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    alert("Saved!");
  }

  const barData = useMemo(() => {
  const labels = leaderboard.map((r) => r.display_name);
  const data = leaderboard.map((r) => r.total_burpees);

  const bg = leaderboard.map((_, i) => colorForIndex(i));
  const border = leaderboard.map((_, i) => borderForIndex(i));

  return {
    labels,
    datasets: [
      {
        label: "Total Burpees (March 2026)",
        data,
        backgroundColor: bg,
        borderColor: border,
        borderWidth: 1
      }
    ]
  };
}, [leaderboard]);

  const myPercent = Math.min(100, Math.round((myTotal / MONTH_GOAL) * 100));

  const doughnutOptions = {
  cutout: "70%",
  plugins: {
    legend: {
      position: "bottom" as const
    },
    tooltip: {
      callbacks: {
        label: (ctx: any) => {
          const label = ctx.label || "";
          const value = ctx.raw || 0;
          return `${label}: ${value} burpees`;
        }
      }
    },
    centerText: {
      text: `${myPercent}%`
    }
  }
};

  const doughnutData = useMemo(() => {
  return {
    labels: ["Completed", "Remaining"],
    datasets: [
      {
        label: "My 3100 Goal Progress",
        data: [myTotal, Math.max(0, MONTH_GOAL - myTotal)],
        backgroundColor: [
          "#22c55e", // green - completed
          "#ef4444"  // red - remaining
        ],
        borderColor: [
          "#16a34a",
          "#dc2626"
        ],
        borderWidth: 1
      }
    ]
  };
}, [myTotal]);

  if (!session) return <Login onEmailSignIn={signInWithEmail} />;

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 20, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>March 2026 Burpee Challenge</h1>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
          <h2>Your entry</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label>
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              Burpees
              <input type="number" min={0} value={burpees} onChange={(e) => setBurpees(Number(e.target.value))} />
            </label>
            <button onClick={submitBurpees} disabled={loading}>Save</button>
          </div>

          <hr style={{ margin: "16px 0" }} />

          <h3>Display name (leaderboard)</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="e.g., JP" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <button onClick={saveDisplayName}>Save name</button>
          </div>

          <p style={{ marginTop: 12 }}>
            <strong>Your total:</strong> {myTotal} burpees<br />
            <strong>Goal:</strong> {MONTH_GOAL} (100/day)<br />
            <strong>Progress:</strong> {myPercent}%<br />
            <strong>Streak:</strong> {streak} day(s)
          </p>

          <div style={{ maxWidth: 420 }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />

          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
          <h2>Leaderboard (Totals)</h2>
          <ol>
            {leaderboard.map((r) => {
              const pct = Math.min(100, Math.round((r.total_burpees / MONTH_GOAL) * 100));
              return (
                <li key={r.user_id} style={{ marginBottom: 8 }}>
                  <strong>{r.display_name}</strong>: {r.total_burpees} ({pct}%)
                </li>
              );
            })}
          </ol>

          <div style={{ marginTop: 16 }}>
            <Bar data={barData} />
          </div>
        </div>
      </section>

      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16, marginTop: 16 }}>
  <h2>Contest Rules</h2>

  <h3>Rule #1. Definition of a burpee</h3>
  <ol>
    <li><strong>Starting Position:</strong> Stand with feet shoulder-width apart.</li>
    <li><strong>Squat:</strong> Lower your hips back and down into a deep squat, placing your hands on the floor in front of you.</li>
    <li><strong>Plank/Push-up:</strong> Kick or step both feet back into a high-plank position. Immediately lower your chest to the floor to perform a push-up (some variations omit the push-up).</li>
    <li><strong>Return:</strong> Jump or step your feet forward back into the deep squat position.</li>
    <li><strong>Jump:</strong> Stand up quickly and perform an explosive jump, bringing your arms overhead.</li>
    <li><strong>Repeat:</strong> Move directly into the next rep.</li>
  </ol>

  <h3>Rule #2. Daily goal</h3>
  <p>
    The goal is to average <strong>100 burpees per day</strong> for the month of March. The burpees may be done at one time
    or throughout the day, based on the honor system (see video entries). The contestant may do more or less than 100 burpees per day.
  </p>

  <h3>Rule #3. Contest window</h3>
  <p>
    The contest will start on <strong>March 1st at 00:01</strong> and conclude on <strong>March 31st at 23:59</strong>.
  </p>

  <h3>Rule #4. Video submissions</h3>
  <p>
    If the burpee session is completed solo, a <strong>time-lapse video</strong> shall be submitted to the text thread created by the founder
    every time a set of burpees is completed. If the burpee session is completed with other members involved in this contest, a time-lapse
    video is not needed.
  </p>

  <h3>Rule #5. Buy-in and payout</h3>
  <p>
    A financial buy-in for the contest will be <strong>$50</strong> (sent via Venmo). The contestant will have the <strong>option</strong> to earn
    their $50 back upon completion of the <strong>3100 burpees</strong>. Those that do not finish their commitment by March 31st at 23:59 will
    forfeit their $50 to a not-for-profit organization of the founder&apos;s choosing (e.g., Chaplains, Wounded Warriors, etc.).
  </p>

  <h3>Rule #6. Injury policy</h3>
  <p>
    If a contestant is hurt during the contest, a <strong>$25 refund</strong> will be issued to the contestant and the remaining $25 will be donated
    to a not-for-profit organization of the founder&apos;s choosing.
  </p>
</div>

  <h2>Audit Log (Transparency)</h2>
  <ol>
    {audit.map((a, i) => (
      <li key={i} style={{ marginBottom: 6 }}>
        <strong>{new Date(a.occurred_at).toLocaleString()}</strong> —{" "}
        <strong>{a.actor_name}</strong>{" "}
        {a.action === "INSERT" ? "created" : a.action === "UPDATE" ? "updated" : "deleted"}{" "}
        <strong>{a.target_name}</strong>’s entry for <strong>{a.entry_date}</strong>
        {" — "}
        <strong>{a.old_burpees ?? "—"} → {a.new_burpees ?? "—"}</strong>
      </li>
    ))}
  </ol>
</div>

      <p style={{ marginTop: 18, color: "#555" }}>
  Transparency note: the audit log shows daily entry changes (including counts) for all contestants.
      </p>
    </main>
  );
}

function Login({ onEmailSignIn }: { onEmailSignIn: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 20, fontFamily: "system-ui" }}>
      <h1>March 2026 Burpee Challenge</h1>
      <p>Sign in with your email (magic link).</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1 }} />
        <button onClick={() => onEmailSignIn(email)} disabled={!email}>Send link</button>
      </div>
    </main>
  );
}
