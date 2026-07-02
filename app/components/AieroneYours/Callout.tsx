export default function Callout({ type = "note", title, children }:{
  type?: "tip"|"note"|"warn"; title: string; children: React.ReactNode;
}) {
  const tone = {
    tip: "from-emerald-500/20 to-emerald-500/5 border-emerald-400/30",
    note: "from-sky-500/20 to-sky-500/5 border-sky-400/30",
    warn: "from-amber-500/20 to-amber-500/5 border-amber-400/30",
  }[type];
  return (
    <div className={`rounded-xl border p-4 bg-gradient-to-b ${tone}`}>
      <div className="font-semibold text-white mb-1">{title}</div>
      <div className="text-slate-200 text-sm leading-7">{children}</div>
    </div>
  );
}
