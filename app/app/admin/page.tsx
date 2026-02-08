"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { CONTEST_START, CONTEST_END } from "../../lib/contest";

type User = {
  user_id: string;
  display_name: string;
};

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(CONTEST_START);
  const [burpees, setBurpees] = useState<number>(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setAllowed(false);
        return;
      }

      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (!isAdmin) {
        setAllowed(false);
        return;
      }

      setAllowed(true);

      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .order("display_name");

      setUsers((data ?? []) as any);
    })();
  }, []);

  async function save() {
    setMsg("");

    const { error } = await supabase.rpc("admin_set_entry", {
      p_user_id: userId,
      p_date: date,
      p_burpees: burpees
    });

    if (error) {
      setMsg(error.message);
    } else {
      setMsg("Saved ✔");
    }
  }

  if (allowed === null) return <main className="container">Loading…</main>;
  if (!allowed)
    return (
      <main className="container">
        <h1>Admin</h1>
        <p>Access denied.</p>
      </main>
    );

  return (
    <main className="container">
      <h1>Admin – Edit Entries</h1>

      <div className="card">
        <label>
          Contestant
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Select…</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.display_name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Date
          <input
            type="date"
            value={date}
            min={CONTEST_START}
            max={CONTEST_END}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label>
          Burpees
          <input
            type="number"
            min={0}
            value={burpees}
            onChange={(e) => setBurpees(Number(e.target.value))}
          />
        </label>

        <button disabled={!userId} onClick={save}>
          Save Entry
        </button>

        {msg && <p className="muted">{msg}</p>}
      </div>
    </main>
  );
}
