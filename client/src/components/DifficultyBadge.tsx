import { Badge } from "@/components/ui/badge";

interface Props {
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export function DifficultyBadge({ difficulty }: Props) {
  const variant = difficulty === "EASY" ? "easy" : difficulty === "MEDIUM" ? "medium" : "hard";
  return <Badge variant={variant}>{difficulty}</Badge>;
}
