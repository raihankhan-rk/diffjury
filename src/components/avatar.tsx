import { type GithubPerson } from "@/lib/github";

function initials(login: string) {
  const parts = login.replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return login.slice(0, 2).toUpperCase();
}

function hue(login: string) {
  let h = 0;
  for (let i = 0; i < login.length; i += 1) {
    h = (h * 31 + login.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function Avatar({
  person,
  size = 28,
}: {
  person: GithubPerson;
  size?: number;
}) {
  const src = person.avatarUrl;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="avatar-img"
        style={{ width: size, height: size }}
      />
    );
  }

  const bg = `hsl(${hue(person.login)} 42% 86%)`;
  const fg = `hsl(${hue(person.login)} 35% 28%)`;
  return (
    <span
      className="avatar-fallback"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(person.login)}
    </span>
  );
}
