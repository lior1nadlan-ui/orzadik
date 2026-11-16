// The growth plan's scoreboard on the dashboard: each goal's value today, its
// target for mid-February 2027, and a link to what moves it (growth-goals.ts).
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  formatGoalValue,
  goalDaysLeft,
  goalProgress,
  goalReached,
  goalTargetLabel,
  GROWTH_GOALS,
  type GoalDef,
} from "@/lib/growth-goals";
import { getGrowthGoals, type GrowthGoalsData } from "@/lib/growth-goals.functions";

const LINK = "font-medium text-primary underline-offset-4 hover:underline";

function GoalAction({ def, data }: { def: GoalDef; data: GrowthGoalsData }) {
  const off = def.action.program ? !data.programs[def.action.program] : false;
  const body = (
    <>
      {def.action.label}
      {off && <span className="font-semibold text-amber-700 dark:text-amber-400"> · כבוי</span>} ←
    </>
  );
  const to = def.action.to;
  return to === "#search-insights" ? (
    <a href={to} className={LINK}>
      {body}
    </a>
  ) : (
    <Link to={to} className={LINK}>
      {body}
    </Link>
  );
}

function detailFor(def: GoalDef, data: GrowthGoalsData): string {
  if (def.key === "emptySearchPct" && data.searches && data.searches.total > 0) {
    return `${data.searches.empty} מתוך ${data.searches.total} חיפושים ב-30 הימים האחרונים`;
  }
  return def.detail;
}

function GoalRow({ def, data }: { def: GoalDef; data: GrowthGoalsData }) {
  const value = data.values[def.key];
  const reached = value !== null && goalReached(def, value);
  const progress = value === null ? 0 : goalProgress(def, value);
  const shown = value === null ? "—" : formatGoalValue(def, value);
  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-sm">
          {def.label}
          {reached && (
            <span className="ms-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              הושג ✓
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm tabular-nums">
          <span className="font-bold">{shown}</span>
          <span className="text-xs text-muted-foreground"> · יעד {goalTargetLabel(def)}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={def.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${shown}, יעד ${goalTargetLabel(def)}`}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full rounded-full ${reached ? "bg-emerald-500" : "bg-primary"}`}
          style={{ width: progress > 0 ? `max(${(progress * 100).toFixed(1)}%, 0.375rem)` : 0 }}
        />
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="text-muted-foreground">{detailFor(def, data)}</span>
        <GoalAction def={def} data={data} />
      </div>
    </li>
  );
}

export function GrowthGoalsCard() {
  const load = useServerFn(getGrowthGoals);
  const { data, isError } = useQuery({
    queryKey: ["admin-growth-goals"],
    queryFn: () => load(),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  if (isError) return null;
  if (!data) return <div className="h-48 animate-pulse rounded-lg bg-muted" aria-hidden />;
  const left = goalDaysLeft(Date.now());
  return (
    <section aria-labelledby="growth-goals-h" className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="growth-goals-h" className="text-sm font-semibold">
          יעדי הצמיחה · עד אמצע פברואר 2027
        </h2>
        <span className="text-xs text-muted-foreground">
          {left > 0 ? `נותרו ${left} ימים` : "תקופת היעדים הסתיימה"}
        </span>
      </div>
      <ul className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
        {GROWTH_GOALS.map((g) => (
          <GoalRow key={g.key} def={g} data={data} />
        ))}
      </ul>
    </section>
  );
}
