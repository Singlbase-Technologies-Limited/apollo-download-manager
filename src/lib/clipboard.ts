import { toast } from 'sonner';

/** Copies `text` and says so, or says it couldn't: `what` names it, as in "Link copied". */
export async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error(`Couldn’t copy the ${what.toLowerCase()}`);
  }
}
