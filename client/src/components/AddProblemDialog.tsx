import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { problems as problemsApi, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

type Difficulty = "EASY" | "MEDIUM" | "HARD";

const DIFFICULTY_OPTIONS: Array<{ value: Difficulty; label: string; activeClass: string }> = [
  { value: "EASY", label: "Easy", activeClass: "border-[#00b8a3] bg-[#00b8a3]/10 text-[#00987f] dark:text-[#2edbc3]" },
  { value: "MEDIUM", label: "Medium", activeClass: "border-[#ffa116] bg-[#ffa116]/10 text-[#b86e00] dark:text-[#ffb84d]" },
  { value: "HARD", label: "Hard", activeClass: "border-[#ff375f] bg-[#ff375f]/10 text-[#e01745] dark:text-[#ff6b8a]" },
];

export function AddProblemDialog({ open, onClose, onAdded }: Props) {
  const [problemNumber, setProblemNumber] = useState("");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [tagsInput, setTagsInput] = useState("");
  const [initialSolvedAt, setInitialSolvedAt] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = /^\d+$/.test(problemNumber.trim()) && title.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);
      await problemsApi.add({
        problemId: parseInt(problemNumber.trim(), 10),
        title: title.trim(),
        difficulty,
        tags,
        initialSolvedAt,
      });
      onAdded();
      handleClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("You're already tracking this problem.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to add problem");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setProblemNumber("");
    setTitle("");
    setDifficulty("MEDIUM");
    setTagsInput("");
    setError("");
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Track a Problem</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <div className="space-y-2">
              <Label htmlFor="problem-number">Number</Label>
              <Input
                id="problem-number"
                type="number"
                inputMode="numeric"
                placeholder="e.g. 1"
                value={problemNumber}
                onChange={(e) => { setProblemNumber(e.target.value); setError(""); }}
                min={1}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="problem-title">Title</Label>
              <Input
                id="problem-title"
                placeholder="e.g. Two Sum"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); }}
                maxLength={200}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Difficulty</Label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTY_OPTIONS.map(({ value, label, activeClass }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDifficulty(value)}
                  className={cn(
                    "rounded-md border py-2 text-sm font-medium transition-all duration-200",
                    difficulty === value
                      ? activeClass
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="problem-tags">
              Tags <span className="text-muted-foreground font-normal">(optional, comma-separated)</span>
            </Label>
            <Input
              id="problem-tags"
              placeholder="e.g. Array, Hash Table"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial-date">Initial solve date</Label>
            <Input
              id="initial-date"
              type="date"
              value={initialSolvedAt}
              onChange={(e) => setInitialSolvedAt(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
            <p className="text-xs text-muted-foreground">
              Stage 1 review will be due 3 days after this date.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Adding…" : "Start Tracking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
