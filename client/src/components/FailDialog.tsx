import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
  problemTitle: string;
}

export function FailDialog({ open, onClose, onSubmit, problemTitle }: Props) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const trimmed = note.trim();
    if (trimmed.length < 10) {
      setError("Please write at least 10 characters explaining what went wrong.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setNote("");
      setError("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setNote(""); setError(""); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Failed — {problemTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="failure-note">
            What went wrong? <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="failure-note"
            placeholder="e.g. Forgot the two-pointer approach, kept trying nested loops…"
            value={note}
            onChange={(e) => { setNote(e.target.value); setError(""); }}
            rows={4}
            className="resize-none"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{error && <span className="text-destructive">{error}</span>}</span>
            <span>{note.trim().length} / 10 min</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting || note.trim().length < 10}>
            {submitting ? "Saving…" : "Record Fail"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
