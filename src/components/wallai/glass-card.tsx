export function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-md sm:p-5 sm:backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}
