// A small local icon set, so the app never depends on an icon CDN.
// Markup comes from the approved design prototype (prototype/visuals.js).
const markup = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  cards:'<rect x="7" y="4" width="13" height="17" rx="2"/><path d="M4 17H3V3a1 1 0 0 1 1-1h11M11 9h5m-5 4h5"/>',
  book:'<path d="M12 6c-2-2-6-3-10-2v15c4-1 8 0 10 2 2-2 6-3 10-2V4c-4-1-8 0-10 2Zm0 0v15"/>',
  grammar:'<path d="M4 5h12M10 3v2c0 8-3 11-6 13m2-9c2 5 5 8 9 10m0 2 4-11 4 11m-6-4h4"/>',
  star:'<path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.3l-5.6 3 1.1-6.3L3 9.6l6.2-.9z"/>',
  settings:'<path d="m9.4 3-.5 2a7 7 0 0 0-1.7 1L5.3 5.4l-2 3.4 1.4 1.5a7 7 0 0 0 0 2l-1.4 1.5 2 3.5 1.9-.6a7 7 0 0 0 1.7 1l.5 2h4l.5-2a7 7 0 0 0 1.7-1l1.9.6 2-3.5-1.4-1.5a7 7 0 0 0 0-2l1.4-1.5-2-3.4-1.9.6a7 7 0 0 0-1.7-1l-.5-2z"/><circle cx="11.4" cy="11.4" r="3"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  leaf:'<path d="M20 3C9 2 3 8 5 14s13 7 15-11ZM4 21 16 9"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
} as const;

export type IconName = keyof typeof markup;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup[name] }} />
  );
}
