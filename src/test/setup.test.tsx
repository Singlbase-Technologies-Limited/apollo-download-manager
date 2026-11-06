// The shared test setup keeps one test's state out of the next (#371).
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { toast, Toaster } from 'sonner';
import { describe, expect, it } from 'vitest';

it('leaves the toast library’s stylesheet out of the page', () => {
  expect(document.head.querySelectorAll('style')).toHaveLength(0);
});

describe('between tests', () => {
  it('shows a toast while its test runs', async () => {
    render(<Toaster />);
    act(() => void toast('Left by an earlier test'));
    expect(await screen.findByText('Left by an earlier test')).toBeTruthy();
  });

  it('doesn’t carry that toast into the next test', async () => {
    render(<Toaster />);
    act(() => void toast('Shown by this test'));
    expect(await screen.findByText('Shown by this test')).toBeTruthy();
    expect(screen.queryByText('Left by an earlier test')).toBeNull();
  });
});
