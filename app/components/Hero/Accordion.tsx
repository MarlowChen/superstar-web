"use client";
import { useState } from "react";

export default function Accordion({ title, children }:{ title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="border border-slate-700/60 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-slate-900/40 hover:bg-slate-900/60 focus:outline-none"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium text-white">{title}</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-4 py-3 text-slate-200/90 leading-7">{children}</div>}
    </section>
  );
}
