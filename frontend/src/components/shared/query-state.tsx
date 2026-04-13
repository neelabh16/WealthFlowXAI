import { Card } from "@/components/shared/card";

export function QueryState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Card className="text-center">
      <p className="font-display text-2xl text-[color:var(--text-strong)]">{title}</p>
      <p className="mt-3 text-sm text-muted">{message}</p>
    </Card>
  );
}
