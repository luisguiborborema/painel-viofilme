/** Avatar de pessoa (foto ou iniciais) e pilha de avatares para múltiplos responsáveis. */

export type AvatarPerson = { name: string; avatarUrl?: string };

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  url,
  size = 24,
}: {
  name: string;
  url?: string;
  size?: number;
}) {
  const dims = { width: size, height: size };
  if (!url) {
    return (
      <span
        title={name}
        style={{ ...dims, fontSize: size <= 24 ? 10 : size <= 32 ? 11 : 13 }}
        className="flex items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-600 ring-2 ring-surface"
      >
        {initials(name)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      title={name}
      style={dims}
      className="rounded-full object-cover ring-2 ring-surface"
    />
  );
}

/** Pilha sobreposta de avatares. Resolve a foto pelo nome, com "+N" para excedentes. */
export function AvatarStack({
  names,
  team = [],
  size = 24,
  max = 3,
}: {
  names: string[];
  team?: AvatarPerson[];
  size?: number;
  max?: number;
}) {
  const unique = names.filter((n, i) => n && names.indexOf(n) === i);
  const shown = unique.slice(0, max);
  const extra = unique.length - shown.length;
  const urlOf = (n: string) => team.find((t) => t.name === n)?.avatarUrl;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((n) => (
        <Avatar key={n} name={n} url={urlOf(n)} size={size} />
      ))}
      {extra > 0 && (
        <span
          style={{ width: size, height: size, fontSize: 10 }}
          className="flex items-center justify-center rounded-full bg-subtle font-semibold text-muted ring-2 ring-surface"
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
