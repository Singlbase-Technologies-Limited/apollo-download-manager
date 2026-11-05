import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/**
 * Picks an option from the app's dropdown (`components/Select`) as a user does: opens the box, then clicks the
 * option by the text it shows. The open list is in a portal, so it is looked up in the whole document.
 * Options are matched by their text, not with a by-name role query: computing the accessible name of every one of
 * a time field's 60 minutes was slow enough to time tests out under a full run.
 */
export async function chooseOption(user: UserEvent, box: HTMLElement, option: string | RegExp) {
  await user.click(box);
  const list = await screen.findByRole('listbox');
  const options = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  const text = (o: HTMLElement) => o.textContent.trim();
  const match = options.find((o) => (typeof option === 'string' ? text(o) === option : option.test(text(o))));
  if (!match) throw new Error(`No option "${String(option)}" in the list; it has: ${options.map(text).join(', ')}`);
  await user.click(match);
}
