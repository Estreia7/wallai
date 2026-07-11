export function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`card p-4 backdrop-blur-md sm:p-5 sm:backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}
