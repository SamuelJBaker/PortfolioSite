import * as React from "react";

export function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="tracking-widest text-xs uppercase text-muted">{eyebrow}</p>
      <h2 className="mt-2 text-2xl md:text-3xl font-semibold">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}
