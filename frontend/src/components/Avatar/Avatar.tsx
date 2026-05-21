import "./Avatar.css";

interface AvatarProps {
  text: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}

export function Avatar({ text, color = "var(--color-primary)", size = "md" }: AvatarProps) {
  return (
    <span className={`bc-avatar bc-avatar-${size}`} style={{ background: color }}>
      {text}
    </span>
  );
}
