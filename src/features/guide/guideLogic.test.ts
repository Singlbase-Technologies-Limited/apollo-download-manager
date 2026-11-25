import { describe, expect, it } from 'vitest';
import { placeBubble, TOUR_STEPS } from './guideLogic';

const view = { width: 1280, height: 800 };
const bubble = { width: 320, height: 180 };

describe('the guide after Get started (#463)', () => {
  it('has 6 steps, the last two title-bar ones lighting Settings and Help (PO decision)', () => {
    expect(TOUR_STEPS).toHaveLength(6);
    expect(TOUR_STEPS.map((s) => s.target)).toEqual(['add', 'toolbar', 'nav', 'settings', 'settings', 'help']);
  });

  it('puts the bubble to the right of a control on the left', () => {
    expect(placeBubble({ left: 8, top: 40, width: 220, height: 32 }, bubble, view)).toEqual({ left: 240, top: 40 });
  });

  it('puts it below a control at the top right, inside the window', () => {
    expect(placeBubble({ left: 1230, top: 4, width: 28, height: 28 }, bubble, view)).toEqual({ left: 938, top: 44 });
  });

  it('puts it to the left of a control at the bottom right', () => {
    expect(placeBubble({ left: 1100, top: 700, width: 170, height: 90 }, bubble, view)).toEqual({ left: 768, top: 612 });
  });

  it('puts it above a control as wide as the window at the bottom', () => {
    expect(placeBubble({ left: 8, top: 700, width: 1264, height: 90 }, bubble, view)).toEqual({ left: 8, top: 508 });
  });

  it('centres it when the control is not on screen', () => {
    expect(placeBubble(null, bubble, view)).toEqual({ left: 480, top: 310 });
    expect(placeBubble({ left: 0, top: 0, width: 0, height: 0 }, bubble, view)).toEqual({ left: 480, top: 310 });
  });

  it('stays inside a narrow window', () => {
    const p = placeBubble({ left: 8, top: 40, width: 40, height: 40 }, bubble, { width: 360, height: 640 });
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left + bubble.width).toBeLessThanOrEqual(352);
  });
});
