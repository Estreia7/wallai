export function GradientBg() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#0A0E1A]">
      <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-emerald-500/15 blur-[80px] sm:blur-[120px]" />
      <div className="absolute -right-40 top-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/15 blur-[80px] sm:blur-[120px]" />
      <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[80px] sm:blur-[120px]" />
    </div>
  );
}
