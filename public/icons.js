const paths = {
  ghost: '<path d="M5 20V10a7 7 0 0 1 14 0v10l-3-2-4 2-4-2-3 2Z"/><ellipse cx="9" cy="10" rx="1" ry="1.6" fill="currentColor" stroke="none"/><ellipse cx="15" cy="10" rx="1" ry="1.6" fill="currentColor" stroke="none"/><path d="m10 15 2 1 2-1"/>',
  setup: '<path d="M5 5h14v16H5zM9 5V3h6v2M9 10h6M9 14h6M9 18h3"/><path d="m3 9 2-1m14 8 2 1"/>',
  blaster: '<path d="m8 4 4-1 6 4-1 5-4 8-6 1-2-5 3-12Z"/><path d="m10 6 4-1 2 3-2 4-5-1 1-5ZM9 15l2 1"/><circle cx="11" cy="18" r=".6" fill="currentColor"/><path d="m20 4 2-1M20 9h2M6 2 5 0"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4M12 14v5m-4 2h8m-8-2h8"/>',
  target: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="5"/><path d="M12 7v10M7 12h10"/>',
  moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/><path d="m18 3 .6 1.8L21 5.5l-2.4.7L18 8l-.6-1.8L15 5.5l2.4-.7L18 3Z"/>',
  pumpkin: '<path d="M12 6c-2-5 2-5 3-4M12 7C4 1 0 10 4 17c2 4 6 5 8 3 3 2 7 1 9-3 3-7-1-16-9-10Z"/><path d="M12 7c-4 4-4 11 0 13m0-13c4 4 4 11 0 13M6 12l3-1-1 3-2-2Zm12 0-3-1 1 3 2-2Zm-10 4 4 2 4-2"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  printer: '<path d="M7 8V3h10v5M7 17H3v-7h18v7h-4M7 14h10v7H7z"/><path d="M17 12h1"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  timer: '<circle cx="12" cy="14" r="8"/><path d="M9 2h6m-3 0v4m6 1 2-2M12 9v5l3 2"/>',
  link: '<path d="m9 15 6-6m-5-2 2-2a5 5 0 0 1 7 7l-2 2M7 10l-2 2a5 5 0 0 0 7 7l2-2"/>',
  alert: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v1"/>',
  back: '<path d="M20 12H5m5-5-5 5 5 5"/>'
};

export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.ghost}</svg>`;
}
