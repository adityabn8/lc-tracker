import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, CheckCircle2, XCircle, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import {
  problems as problemsApi,
  attempts as attemptsApi,
  TrackedProblemDetail,
  AttemptResult,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { FailDialog } from "@/components/FailDialog";

export function ProblemDetailPage() {
  const { trackedId } = useParams<{ trackedId: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<TrackedProblemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failOpen, setFailOpen] = useState(false);
  const [undoAttemptId, setUndoAttemptId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    if (!trackedId) return;
    setLoading(true);
    try {
      const data = await problemsApi.detail(trackedId);
      setItem(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [trackedId]);

  const handlePass = async () => {
    if (!item) return;
    const result: AttemptResult = await attemptsApi.pass(item.id);
    setUndoAttemptId(result.attempt.id);
    await load();
  };

  const handleFail = async (note: string) => {
    if (!item) return;
    const result: AttemptResult = await attemptsApi.fail(item.id, note);
    setUndoAttemptId(result.attempt.id);
    setFailOpen(false);
    await load();
  };

  const handleUndo = async () => {
    if (!item || !undoAttemptId) return;
    await attemptsApi.undo(item.id, undoAttemptId);
    setUndoAttemptId(null);
    await load();
  };

  const handleRestart = async () => {
    if (!item) return;
    await problemsApi.restart(item.id);
    await load();
  };

  const handleDelete = async () => {
    if (!item) return;
    await problemsApi.remove(item.id);
    navigate("/problems");
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>;
  if (!item) return <div className="text-center py-12 text-muted-foreground">Problem not found.</div>;

  const isDue = item.status === "ACTIVE" && item.daysOverdue !== null && item.daysOverdue >= 0;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <Link to="/problems" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Problems
        </Link>
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm text-muted-foreground font-mono">#{item.problem.id}</span>
            <h1 className="text-2xl font-bold mt-0.5">{item.problem.title}</h1>
          </div>
          <a href={item.problem.url} target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground mt-1">
            <ExternalLink className="h-5 w-5" />
          </a>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <DifficultyBadge difficulty={item.problem.difficulty} />
          {item.problem.tags.map((t) => (
            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
          ))}
        </div>
      </div>

      {/* Status card */}
      <div className="border rounded-lg p-4 bg-card space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-semibold text-sm mt-0.5">
              {item.status === "MASTERED" ? "✦ Mastered" : "Active"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stage</p>
            <p className="font-semibold text-sm mt-0.5">
              {item.status === "MASTERED" ? "4/4" : `${item.currentStage}/4`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Next Due</p>
            <p className="font-semibold text-sm mt-0.5">
              {item.nextDueDate ?? "—"}
              {item.daysOverdue !== null && item.daysOverdue > 0 && (
                <span className="text-destructive ml-1 text-xs">({item.daysOverdue}d late)</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Resets</p>
            <p className="font-semibold text-sm mt-0.5">{item.resetCount}</p>
          </div>
        </div>

        {/* Actions */}
        {item.status === "ACTIVE" && isDue && (
          <div className="flex gap-2">
            <Button size="touch" variant="success" className="flex-1 gap-2" onClick={handlePass}>
              <CheckCircle2 className="h-5 w-5" /> Pass
            </Button>
            <Button size="touch" variant="destructive" className="flex-1 gap-2" onClick={() => setFailOpen(true)}>
              <XCircle className="h-5 w-5" /> Fail
            </Button>
          </div>
        )}

        {item.status === "MASTERED" && (
          <Button variant="outline" className="w-full gap-2" onClick={handleRestart}>
            <RotateCw className="h-4 w-4" /> Restart cycle
          </Button>
        )}

        {undoAttemptId && (
          <button
            onClick={handleUndo}
            className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Undo last attempt
          </button>
        )}
      </div>

      {/* Attempt history */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Attempt History</h2>
        {item.attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attempts recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {[...item.attempts].reverse().map((a) => (
              <div key={a.id} className="border rounded-md p-3 bg-card flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {a.outcome === "PASS" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">Stage {a.stage}</span>
                    <span className="text-xs text-muted-foreground">{a.attemptedAt}</span>
                    <Badge variant={a.outcome === "PASS" ? "default" : "destructive"} className="text-xs">
                      {a.outcome}
                    </Badge>
                  </div>
                  {a.failureNote && (
                    <p className="text-sm text-muted-foreground mt-1 italic">"{a.failureNote}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="border border-destructive/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-destructive mb-2">Remove from tracking</h3>
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1">
              <Trash2 className="h-4 w-4" /> Confirm remove
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="text-destructive">
            Remove problem
          </Button>
        )}
      </div>

      <FailDialog
        open={failOpen}
        onClose={() => setFailOpen(false)}
        onSubmit={handleFail}
        problemTitle={item.problem.title}
      />
    </div>
  );
}
