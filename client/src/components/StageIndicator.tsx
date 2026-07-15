import { cn } from "@/lib/utils";

interface Props {
  stage: number;
  status: "ACTIVE" | "MASTERED";
}

export function StageIndicator({ stage, status }: Props) {
  if (status === "MASTERED") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 dark:text-purple-300">
        ✦ Mastered
      </span>
    );
  }

  const nextStage = Math.min(stage + 1, 5);

  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="inline-flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <span
            key={s}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              s <= stage
                ? "w-4 bg-success"
                : s === nextStage
                ? "w-4 bg-primary/70 animate-pulse"
                : "w-1.5 bg-muted-foreground/25"
            )}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">
        {stage === 0 ? (
          <>Stage 1 <span className="text-foreground font-medium">due</span></>
        ) : (
          <>
            Stage {stage} passed · Stage {nextStage}{" "}
            <span className="text-foreground font-medium">due</span>
          </>
        )}
      </span>
    </span>
  );
}
