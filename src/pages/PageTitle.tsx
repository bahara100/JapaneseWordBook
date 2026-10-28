import type { ReactNode } from 'react';

export function PageTitle({ eyebrow, heading, lead, extra }: {
  eyebrow: string; heading: ReactNode; lead: ReactNode; extra?: ReactNode;
}) {
  return (
    <>
      <div className="eyebrow">{eyebrow}</div>
      <div className="page-title"><h1 tabIndex={-1}>{heading}</h1>{extra}</div>
      <p className="lead">{lead}</p>
    </>
  );
}
