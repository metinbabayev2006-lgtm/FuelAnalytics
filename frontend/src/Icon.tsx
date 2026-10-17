type Name = 'fuel' | 'search' | 'map' | 'chart' | 'arrow' | 'layers'
const paths: Record<Name, string> = {
  fuel: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M5 7h8M14 10h2a2 2 0 0 1 2 2v5a2 2 0 0 0 4 0V9l-4-4M19 6v4h3',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  map: 'M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3ZM9 3v15M15 6v15',
  chart: 'M3 3v18h18M7 14l4-4 4 3 6-8',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  layers: 'M12 3l10 6-10 6L2 9l10-6ZM2 14l10 6 10-6',
}
export function Icon({ name, className = '' }: { name: Name; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
