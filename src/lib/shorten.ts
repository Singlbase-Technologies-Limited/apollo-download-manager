/** The longest value shown whole in the details panel: about two lines at its narrowest (#349). */
const SHOWN_WHOLE = 60;

/** `text` cut in the middle to at most `max` characters, keeping more of its end, where names are. */
function cutMiddle(text: string, max = SHOWN_WHOLE): string {
  if (text.length <= max) return text;
  const head = Math.floor((max - 1) * 0.4);
  const tail = max - 1 - head;
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}

/**
 * A link short enough for the details panel (#349): whole when it fits, else its host and file name, without the
 * query, which holds tokens no one reads. A link that isn't an address, such as a magnet, is cut in the middle.
 */
export function shortenUrl(url: string): string {
  if (url.length <= SHOWN_WHOLE) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return cutMiddle(url);
  }
  if (!parsed.host) return cutMiddle(url);
  const segments = parsed.pathname.split('/').filter((s) => s !== '');
  const file = segments.at(-1);
  if (file === undefined) return cutMiddle(url);
  const name = decodeURIComponentSafe(file);
  return segments.length > 1 ? `${parsed.host}/…/${name}` : `${parsed.host}/${name}`;
}

/** A folder short enough for the details panel: whole when it fits, else its start and end around "…". */
export function shortenPath(path: string): string {
  return cutMiddle(path);
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
