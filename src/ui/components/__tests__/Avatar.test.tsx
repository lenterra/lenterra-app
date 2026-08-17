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
import renderer from 'react-test-renderer';
import { View } from 'react-native';

import { Avatar, initialsOf } from '../Avatar';

/** The flattened style of the avatar circle. */
function circleStyle(element: React.ReactElement): Record<string, unknown> {
  const tree = renderer.create(element);
  const root = tree.root.findByType(View);
  const style = root.props.style as unknown;
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
    const tree = renderer.create(<Avatar name="Rina Lestari" color="#0E7C86" />);
    expect(tree.root.findByType(View).props.accessibilityLabel).toBe('Rina Lestari');
  });
});
