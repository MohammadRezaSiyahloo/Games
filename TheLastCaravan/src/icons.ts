const paths: Record<string, string> = {
  settings:
    '<path d="M5 3v18m7-18v18m7-18v18"/><path fill="currentColor" stroke="none" d="M2 7h6v3H2zm7 7h6v3H9zm7-7h6v3h-6z"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6zM9 3v15M15 6v15"/>',
  crew: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M17 5a3 3 0 0 1 0 6m4 9v-2a4 4 0 0 0-3-4"/>',
  journal:
    '<path d="M5 3h13a2 2 0 0 1 2 2v16H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2zm-2 15a2 2 0 0 1 2-2h15M7 7h9M7 11h7"/>',
  food: '<path d="M12 22V3m0 15c-5 0-7-3-7-6 4 0 7 2 7 6zm0-5c-5 0-7-3-7-6 4 0 7 2 7 6zm0 5c5 0 7-3 7-6-4 0-7 2-7 6zm0-5c5 0 7-3 7-6-4 0-7 2-7 6z"/>',
  water: '<path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13zm-4 14a4 4 0 0 0 4 3"/>',
  medicine:
    '<path d="M7 3h10v4H7zM8 7v3l-3 4v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6l-3-4V7m-4 5v6m-3-3h6"/>',
  coins:
    '<ellipse cx="10" cy="6" rx="7" ry="3"/><path d="M3 6v4c0 2 3 3 7 3m-7-3v4c0 2 3 3 7 3m7-11v3"/><circle cx="16" cy="15" r="5"/><path d="M16 13v4"/>',
  materials: '<path d="m3 7 9-4 9 4v10l-9 4-9-4V7zm0 0 9 4 9-4m-9 4v10M7 5l10 4v4"/>',
  wagon:
    '<path d="M3 15V9a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v6H3zm2 0v3m12-3v3m2-3h3M8 5v10m6-10v10"/><circle cx="6" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>',
  heart: '<path d="M20 5c-2-2-6-1-8 2-2-3-6-4-8-2-3 3-2 7 1 10l7 6 7-6c3-3 4-7 1-10z"/>',
  arrow: '<path d="M3 12h17m-6-6 6 6-6 6"/>',
  fire: '<path d="M12 2c3 5 1 7 4 10 1-1 2-2 2-4 3 4 4 8 1 11-4 4-10 4-14 0-3-3-2-7 1-10 0 3 1 4 2 4 2-4 1-8 4-11z"/>',
  tower:
    '<path d="M5 21h14M6 21V10l-2-3V3h4v3h2V3h4v3h2V3h4v4l-2 3v11m-8 0v-4a2 2 0 0 1 4 0v4M10 11h4"/>',
  mountain: '<path d="m2 20 8-15 4 7 2-3 6 11H2zm5-9 3 2 2-2"/>',
  city: '<path d="M2 21h20M4 21V9h4v3h2V6l2-3 2 3v6h2V9h4v12m-10 0v-4h4v4M4 6v3m16-3v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3z"/>',
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4 4-2zM12 1v3m0 16v3M1 12h3m16 0h3"/>',
  cross: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m8 5 7 7-7 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
};
export const icon = (id: string, size = 20) =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${paths[id] ?? ''}</svg>`;
