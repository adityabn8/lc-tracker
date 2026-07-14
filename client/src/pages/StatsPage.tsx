import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { stats as statsApi, Stats } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DIFFICULTY_COLORS = {
  EASY: "#00b8a3",
  MEDIUM: "#ffa116",
  HARD: "#ff375f",
} as const;

export function StatsPage() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.get().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-24 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const retentionPct =
    data.retentionRate !== null ? Math.round(data.retentionRate * 100) : null;

  const difficultyTotal =
    data.difficultyBreakdown.EASY +
    data.difficultyBreakdown.MEDIUM +
    data.difficultyBreakdown.HARD;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight animate-fade-up">Stats</h1>

      {/* Overview + attempt stats: one row on wide screens */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <StatCard label="Total tracked" value={data.totalTracked} />
        <StatCard label="Active" value={data.totalActive} />
        <StatCard label="Mastered" value={data.totalMastered} color="purple" />
        <StatCard
          label="Retention rate"
          value={retentionPct !== null ? `${retentionPct}%` : "—"}
          color={retentionPct !== null && retentionPct >= 70 ? "green" : undefined}
        />
        <StatCard label="Total attempts" value={data.totalAttempts} />
        <StatCard label="Passes" value={data.passAttempts} color="green" />
        <StatCard label="Total resets" value={data.totalResets} color="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
      {/* Upcoming */}
      <Card className="animate-fade-up" style={{ animationDelay: "120ms" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upcoming Load</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold tabular-nums">{data.upcoming.next7}</p>
            <p className="text-sm text-muted-foreground">due in 7 days</p>
          </div>
          <div>
            <p className="text-3xl font-bold tabular-nums">{data.upcoming.next30}</p>
            <p className="text-sm text-muted-foreground">due in 30 days</p>
          </div>
        </CardContent>
      </Card>

      {/* Difficulty breakdown */}
      <Card className="animate-fade-up" style={{ animationDelay: "160ms" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">By Difficulty</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stacked distribution bar */}
          {difficultyTotal > 0 && (
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {(["EASY", "MEDIUM", "HARD"] as const).map((d) => {
                const count = data.difficultyBreakdown[d];
                if (count === 0) return null;
                return (
                  <div
                    key={d}
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${(count / difficultyTotal) * 100}%`,
                      backgroundColor: DIFFICULTY_COLORS[d],
                    }}
                  />
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 text-center">
            {(["EASY", "MEDIUM", "HARD"] as const).map((d) => (
              <div key={d}>
                <p className="text-2xl font-bold tabular-nums" style={{ color: DIFFICULTY_COLORS[d] }}>
                  {data.difficultyBreakdown[d]}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{d.toLowerCase()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
      {/* Weak spots */}
      {data.weakSpots.length > 0 && (
        <Card className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weak Spots (Most Resets)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.weakSpots.map((w) => (
              <Link
                key={w.id}
                to={`/problems/${w.id}`}
                className="flex items-center justify-between rounded-md p-2.5 hover:bg-muted transition-colors"
              >
                <span className="text-sm font-medium truncate">{w.problem.title}</span>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-xs text-muted-foreground">{w.problem.difficulty}</span>
                  <Badge variant="destructive" className="text-xs">
                    {w.resetCount} reset{w.resetCount > 1 ? "s" : ""}
                  </Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top tags */}
      {data.topTags.length > 0 && (
        <Card className="animate-fade-up" style={{ animationDelay: "240ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tags You're Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.topTags.map(({ tag, count }) => (
                <div key={tag} className="flex items-center gap-1">
                  <Badge variant="outline">{tag}</Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: "green" | "purple" | "red";
}) {
  const colorClass =
    color === "green"
      ? "text-success"
      : color === "purple"
      ? "text-purple-600 dark:text-purple-300"
      : color === "red"
      ? "text-destructive"
      : "text-foreground";

  return (
    <Card className="hover:shadow-md">
      <CardContent className="pt-4 pb-4 text-center">
        <p className={`text-3xl font-bold tabular-nums ${colorClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
