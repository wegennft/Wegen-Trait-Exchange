interface SmackzCoinProps {
  className?: string;
  size?: number;
}

export function SmackzCoin({ className = "", size = 24 }: SmackzCoinProps) {
  return (
    <span
      className={`smackz-coin ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="smackz-coin-face" style={{ fontSize: size * 0.55 }}>
        🖐️
      </span>
    </span>
  );
}
