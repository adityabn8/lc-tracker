import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, ExternalLink } from "lucide-react";
import { problems as problemsApi, TrackedProblem } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { AddProblemDialog } from "@/components/AddProblemDialog";

export function ProblemsPage() {
  const [items, setItems] = useState<TrackedProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("nextDueDate");
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await problemsApi.list({ search, difficulty, status, sort });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [search, difficulty, status, sort]);

  useEffect(() => { load(); }, [load]);

  const stageLabel = (stage: number) =>
    stage === 0 ? "Due S1" : `Done S${stage}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Problems</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {items.length} tracked
            </p>
          )}
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm">+ Add</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 animate-fade-up">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by number or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={difficulty || "all"} onValueChange={(v) => setDifficulty(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulties</SelectItem>
            <SelectItem value="EASY">Easy</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HARD">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="MASTERED">Mastered</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nextDueDate">Sort: Due date</SelectItem>
            <SelectItem value="createdAt">Sort: Date added</SelectItem>
            <SelectItem value="resetCount">Sort: Most resets</SelectItem>
            <SelectItem value="difficulty">Sort: Difficulty</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-3 bg-card animate-pulse">
              <div className="h-4 w-1/2 rounded bg-muted mb-2" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No problems found.{" "}
          <button onClick={() => setAddOpen(true)} className="text-primary hover:underline">
            Add one?
          </button>
        </div>
      )}

      <div className="grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="border rounded-lg p-3 bg-card flex items-start gap-3 shadow-sm shadow-black/[0.03] dark:shadow-black/20 transition-all duration-200 hover:shadow-md hover:border-primary/30 animate-fade-up"
            style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">#{item.problem.id}</span>
                <Link
                  to={`/problems/${item.id}`}
                  className="font-medium text-sm hover:underline"
                >
                  {item.problem.title}
                </Link>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <DifficultyBadge difficulty={item.problem.difficulty} />
                <Badge variant={item.status === "MASTERED" ? "mastered" : "active"}>
                  {item.status === "MASTERED" ? "Mastered" : stageLabel(item.currentStage)}
                </Badge>
                {item.nextDueDate && item.status === "ACTIVE" && (
                  <span className="text-xs text-muted-foreground">
                    due {item.nextDueDate}
                    {item.daysOverdue !== null && item.daysOverdue > 0 && (
                      <span className="text-destructive ml-1">({item.daysOverdue}d overdue)</span>
                    )}
                  </span>
                )}
                {item.resetCount > 0 && (
                  <span className="text-xs text-muted-foreground">{item.resetCount} reset{item.resetCount > 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
            <a
              href={item.problem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ))}
      </div>

      <AddProblemDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />
    </div>
  );
}
