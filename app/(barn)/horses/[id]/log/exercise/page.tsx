"use client";

import { useHorseName } from "@/hooks/useHorseName";
import { supabase } from "@/lib/supabase";
import { todayISODate } from "@/lib/today";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const EXERCISE_TYPES = [
  "Gallop",
  "Breeze",
  "Jog",
  "Walk",
  "Gate Work",
  "Swim",
  "Treadmill",
  "Turnout",
] as const;

const TRACK_CONDITIONS = [
  "Fast",
  "Good",
  "Muddy",
  "Sloppy",
  "Firm",
  "Yielding",
  "Soft",
  "Heavy",
] as const;

type ExerciseType = (typeof EXERCISE_TYPES)[number];

function distanceLabel(type: ExerciseType): string {
  if (type === "Gallop" || type === "Breeze") return "Distance (furlongs)";
  if (type === "Jog" || type === "Walk") return "Distance (miles)";
  return "Distance (optional)";
}

function showSpeedField(type: ExerciseType): boolean {
  return type === "Gallop" || type === "Breeze";
}

export default function ExerciseLogPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const { name, loading: nameLoading } = useHorseName(id);

  const [exerciseType, setExerciseType] =
    useState<ExerciseType>("Gallop");
  const [distance, setDistance] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [speedAvg, setSpeedAvg] = useState("");
  const [trackCondition, setTrackCondition] =
    useState<(typeof TRACK_CONDITIONS)[number]>("Fast");
  const [notes, setNotes] = useState("");
  const [logDate, setLogDate] = useState(todayISODate);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const distLabel = useMemo(
    () => distanceLabel(exerciseType),
    [exerciseType],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dur = parseInt(durationMinutes, 10);
    if (!durationMinutes.trim() || Number.isNaN(dur) || dur < 0) {
      setError("Please enter a valid duration in minutes.");
      return;
    }

    const distNum =
      distance.trim() === "" ? null : parseFloat(distance.replace(",", "."));
    if (distance.trim() !== "" && (distNum === null || Number.isNaN(distNum))) {
      setError("Please enter a valid distance or leave it blank.");
      return;
    }

    let speedNum: number | null = null;
    if (showSpeedField(exerciseType) && speedAvg.trim() !== "") {
      const s = parseFloat(speedAvg.replace(",", "."));
      if (Number.isNaN(s)) {
        setError("Average speed must be a valid number (seconds per furlong).");
        return;
      }
      speedNum = s;
    }

    const noteParts = [`Track condition: ${trackCondition}`];
    if (notes.trim()) noteParts.push(notes.trim());
    const fullNotes = noteParts.join("\n\n");

    const createdAt = new Date(`${logDate}T12:00:00`);

    setSubmitting(true);
    const { error: insertError } = await supabase.from("activity_log").insert({
      horse_id: id,
      logged_by: null,
      activity_type: exerciseType,
      notes: fullNotes,
      distance: distNum,
      duration_minutes: dur,
      speed_avg: speedNum,
      created_at: createdAt.toISOString(),
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push(`/horses/${id}?log=success`);
  }

  if (!id) {
    return (
      <div className="min-h-full bg-parchment px-4 py-16 text-center text-oak">
        Invalid link.
      </div>
    );
  }

  return (
    <div className="min-h-full bg-parchment pb-10">
      <div className="border-b border-border-warm bg-cream px-4 py-3 sm:px-6">
        <Link
          href={`/horses/${id}/log`}
          className="text-sm font-semibold text-brass hover:text-brass-light"
        >
          ← Log menu
        </Link>
      </div>

      <main className="mx-auto max-w-lg px-4 pt-6 sm:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-brass">
          Exercise
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-barn-dark">
          {nameLoading ? "Loading…" : name ?? "Horse"}
        </h1>
        <p className="mt-1 text-center text-sm text-oak">
          Record a workout or movement session
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error ? (
            <div
              className="rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="exercise_type"
              className="block text-sm font-medium text-oak"
            >
              Exercise type
            </label>
            <select
              id="exercise_type"
              value={exerciseType}
              onChange={(e) =>
                setExerciseType(e.target.value as ExerciseType)
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
            >
              {EXERCISE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="distance" className="block text-sm font-medium text-oak">
              {distLabel}
            </label>
            <input
              id="distance"
              type="text"
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
              placeholder="0"
            />
          </div>

          <div>
            <label
              htmlFor="duration"
              className="block text-sm font-medium text-oak"
            >
              Duration (minutes) <span className="text-alert">*</span>
            </label>
            <input
              id="duration"
              type="number"
              inputMode="numeric"
              min={0}
              required
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
              placeholder="e.g. 30"
            />
          </div>

          {showSpeedField(exerciseType) ? (
            <div>
              <label
                htmlFor="speed"
                className="block text-sm font-medium text-oak"
              >
                Average speed (optional, sec/furlong)
              </label>
              <input
                id="speed"
                type="text"
                inputMode="decimal"
                value={speedAvg}
                onChange={(e) => setSpeedAvg(e.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
                placeholder="e.g. 12.4"
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="track"
              className="block text-sm font-medium text-oak"
            >
              Track condition
            </label>
            <select
              id="track"
              value={trackCondition}
              onChange={(e) =>
                setTrackCondition(
                  e.target.value as (typeof TRACK_CONDITIONS)[number],
                )
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
            >
              {TRACK_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-oak"
            >
              Notes
            </label>
            <textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
              placeholder='e.g. "Moved well," "A little short behind"'
            />
          </div>

          <div>
            <label
              htmlFor="log_date"
              className="block text-sm font-medium text-oak"
            >
              Date
            </label>
            <input
              id="log_date"
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-border-warm bg-white px-4 py-3 text-base text-barn-dark shadow-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/25"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link
              href={`/horses/${id}/log`}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border-warm bg-cream px-6 text-base font-semibold text-barn-dark hover:bg-parchment"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brass px-6 text-base font-semibold text-barn-dark shadow-sm hover:bg-brass-light disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save exercise"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
