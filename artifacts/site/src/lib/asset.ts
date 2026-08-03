export function asset(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}
