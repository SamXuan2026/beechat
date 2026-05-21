import "./EmptyState.css";

interface EmptyStateProps {
  text: string;
}

export function EmptyState({ text }: EmptyStateProps) {
  return <div className="bc-empty">{text}</div>;
}
