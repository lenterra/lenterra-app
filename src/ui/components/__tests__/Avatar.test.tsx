/**
 * The avatar, and the one purchase that reaches it.
 *
 * Two behaviours matter and they pull against each other. A student who has
 * bought nothing must keep the colour their classmates already know them by,
 * derived from their name and stable forever. A student who has bought one must
 * see it everywhere, immediately. Getting the first wrong is worse: it would
 * silently restyle every child in a class for a feature none of them used.
 */

import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

import { Avatar, initialsOf } from '../Avatar';

/**
 * The rendered tree as plain JSON.
 *
 * Read through `toJSON` rather than `root.findByType(View)`. The instance API
 * ties the test to how React types host components, which changed under React
 * 19 and broke three assertions that were still describing correct behaviour —
 * a test failing for a reason that has nothing to do with its subject.
 */
type Node = { props: Record<string, unknown>; children: Node[] | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React 19
// narrowed ReactElement's default type argument to `unknown`, while
// react-test-renderer still asks for `any`. Nothing here reads the props of
// the element being passed in, so the widening costs no safety.
function render(element: React.ReactElement<any>): Node {
  // React 19 requires every render to be inside `act`, including one that
  // triggers no state update. Without it the tree still renders and every
  // assertion fails on a warning rather than on the thing being asserted.
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  return tree.toJSON() as unknown as Node;
}

/** The flattened style of the avatar circle, which is the outermost node. */
function circleStyle(element: React.ReactElement): Record<string, unknown> {
  const style = render(element).props.style;
  const layers = Array.isArray(style) ? style : [style];
  return Object.assign({}, ...layers.filter(Boolean).map((layer) => layer as object));
}

describe('initialsOf', () => {
  it('takes the first and last initial of a full name', () => {
    expect(initialsOf('Rina Ayu Lestari')).toBe('RL');
  });

  it('takes one letter from a single name', () => {
    // Common in Indonesia, and the reason this is not simply `split(' ')[0][0] +
    // split(' ')[1][0]`, which would throw.
    expect(initialsOf('Sukarno')).toBe('S');
  });

  it('survives an empty or whitespace name rather than throwing', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });

  it('collapses repeated spaces', () => {
    expect(initialsOf('Rina    Lestari')).toBe('RL');
  });
});

describe('Avatar', () => {
  it('derives a colour from the name when nothing is equipped', () => {
    const style = circleStyle(<Avatar name="Rina Lestari" />);
    expect(typeof style.backgroundColor).toBe('string');
  });

  it('gives the same student the same colour every time', () => {
    // A colour that changed between renders would make the avatar useless as a
    // way of recognising somebody in a list of forty.
    const first = circleStyle(<Avatar name="Rina Lestari" />);
    const second = circleStyle(<Avatar name="Rina Lestari" />);
    expect(first.backgroundColor).toBe(second.backgroundColor);
  });

  it('uses an equipped colour instead', () => {
    const style = circleStyle(<Avatar name="Rina Lestari" color="#0E7C86" />);
    expect(style.backgroundColor).toBe('#0E7C86');
  });

  it('falls back to the derived colour when a colour is taken off', () => {
    // Null is "no purchase", never "black". Taking a colour off has to return
    // a student to the one their class already knows them by.
    const derived = circleStyle(<Avatar name="Rina Lestari" />);
    const cleared = circleStyle(<Avatar name="Rina Lestari" color={null} />);
    expect(cleared.backgroundColor).toBe(derived.backgroundColor);
  });

  it('keeps the size and roundness independent of the colour', () => {
    const style = circleStyle(<Avatar name="Rina" size={64} color="#0E7C86" />);
    expect(style.width).toBe(64);
    expect(style.height).toBe(64);
    expect(style.borderRadius).toBe(32);
  });

  it('labels itself with the name for a screen reader', () => {
    expect(render(<Avatar name="Rina Lestari" color="#0E7C86" />).props.accessibilityLabel).toBe(
      'Rina Lestari',
    );
  });
});
