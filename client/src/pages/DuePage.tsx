import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, CheckCircle2, XCircle, RotateCcw, Clock, Plus, PartyPopper } from "lucide-react";
import { problems as problemsApi, attempts as attemptsApi, TrackedProblem, AttemptResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { StageIndicator } from "@/components/StageIndicator";
import { FailDialog } from "@/components/FailDialog";
import { AddProblemDialog } from "@/components/AddProblemDialog";

interface UndoState {
  trackedId: string;
  attemptId: string;
  prevState: TrackedProblem;
}

export function DuePage() {
  const [dueItems, setDueItems] = useState<TrackedProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [failTarget, setFailTarget] = useState<TrackedProblem | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await problemsApi.due();
      setDueItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load next upcoming due date when queue is empty
  useEffect(() => {
    if (!loading && dueItems.length === 0) {
      problemsApi.list({ status: "ACTIVE", sort: "nextDueDate" }).then((all) => {
        const next = all.find((p) => p.nextDueDate)?.nextDueDate;
        setNextDue(next ?? null);
      });
    }
  }, [loading, dueItems.length]);

  const handlePass = async (item: TrackedProblem) => {
    const result: AttemptResult = await attemptsApi.pass(item.id);
    setUndo({ trackedId: item.id, attemptId: result.attempt.id, prevState: item });
    setDueItems((prev) => prev.filter((p) => p.id !== item.id));
  };

  const handleFail = async (note: string) => {
    if (!failTarget) return;
    const result: AttemptResult = await attemptsApi.fail(failTarget.id, note);
    setUndo({ trackedId: failTarget.id, attemptId: result.attempt.id, prevState: failTarget });
    setDueItems((prev) => prev.filter((p) => p.id !== failTarget.id));
    setFailTarget(null);
    // After fail, reload — the item stays ACTIVE and may reappear after 3 days
  };

  const handleUndo = async () => {
    if (!undo) return;
    await attemptsApi.undo(undo.trackedId, undo.attemptId);
    setDueItems((prev) => [...prev, undo.prevState].sort((a, b) => {
      if (!a.nextDueDate) return 1;
      if (!b.nextDueDate) return -1;
      return a.nextDueDate.localeCompare(b.nextDueDate);
    }));
    setUndo(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Due Today</h1>
          {!loading && dueItems.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {dueItems.length} problem{dueItems.length > 1 ? "s" : ""} to review
            </p>
          )}
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Problem
        </Button>
      </div>

      {loading && (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 bg-card space-y-3 animate-pulse">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
              <div className="h-10 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {!loading && dueItems.length === 0 && (
        <div className="text-center py-16 space-y-3 animate-fade-up">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <PartyPopper className="h-8 w-8 text-success" />
          </div>
          <p className="text-xl font-semibold">All caught up!</p>
          {nextDue ? (
            <p className="text-sm text-muted-foreground">
              Next review due <strong className="text-foreground">{nextDue}</strong>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing scheduled yet — add a problem to get started.
            </p>
          )}
          <Button variant="outline" className="mt-2 gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add a Problem
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {dueItems.map((item, i) => (
        <div
          key={item.id}
          className="group border rounded-lg p-4 sm:p-5 bg-card space-y-3.5 shadow-sm shadow-black/[0.03] dark:shadow-black/20 transition-all duration-200 hover:shadow-md hover:border-primary/30 animate-fade-up flex flex-col"
          style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                  #{item.problem.id}
                </span>
                <Link
                  to={`/problems/${item.id}`}
                  className="font-semibold text-base hover:text-primary transition-colors truncate"
                >
                  {item.problem.title}
                </Link>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <DifficultyBadge difficulty={item.problem.difficulty} />
                {item.problem.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs font-normal">
                    {tag}
                  </Badge>
                ))}
                {item.daysOverdue !== null && item.daysOverdue > 0 && (
                  <span className="flex items-center gap-1 text-xs text-destructive font-medium">
                    <Clock className="h-3 w-3" />
                    {item.daysOverdue}d overdue
                  </span>
                )}
              </div>
            </div>
            <a
              href={item.problem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground flex-shrink-0"
              title="Open on LeetCode"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="flex items-center text-sm flex-1">
            <StageIndicator stage={item.currentStage} status={item.status} />
            {item.resetCount > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                · {item.resetCount} reset{item.resetCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex gap-2.5">
            <Button
              size="touch"
              variant="success"
              className="flex-1 gap-2"
              onClick={() => handlePass(item)}
            >
              <CheckCircle2 className="h-5 w-5" />
              Pass
            </Button>
            <Button
              size="touch"
              variant="destructive"
              className="flex-1 gap-2"
              onClick={() => setFailTarget(item)}
            >
              <XCircle className="h-5 w-5" />
              Fail
            </Button>
          </div>
        </div>
      ))}
      </div>

      {/* Undo toast */}
      {undo && (
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 flex justify-center px-4 z-50">
          <div className="animate-toast-in bg-foreground text-background rounded-full pl-5 pr-3 py-2.5 flex items-center gap-3 shadow-lg max-w-sm w-full">
            <span className="text-sm flex-1">Attempt recorded</span>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              <RotateCcw className="h-4 w-4" />
              Undo
            </button>
            <button
              onClick={() => setUndo(null)}
              className="flex h-7 w-7 items-center justify-center rounded-full opacity-60 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <FailDialog
        open={!!failTarget}
        onClose={() => setFailTarget(null)}
        onSubmit={handleFail}
        problemTitle={failTarget?.problem.title ?? ""}
      />

      <AddProblemDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />
    </div>
  );
}
