import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';
import { Textarea } from './Textarea';

// #345: the window's autofill kept typed links, folders and the proxy user name outside the app's
// data. Every text field opts out, unless a caller asks for something else.
describe('text fields and autofill', () => {
  it('an input asks the window not to remember what is typed', () => {
    render(<Input aria-label="Link" />);
    expect(screen.getByLabelText('Link').getAttribute('autocomplete')).toBe('off');
  });

  it('a text area asks the same', () => {
    render(<Textarea aria-label="Links" />);
    expect(screen.getByLabelText('Links').getAttribute('autocomplete')).toBe('off');
  });

  it('a caller can still choose another value', () => {
    render(<Input aria-label="Password" autoComplete="new-password" />);
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('new-password');
  });
});
