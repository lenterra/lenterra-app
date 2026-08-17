/**
 * The launcher icons.
 *
 * The icon was the source logo at 920×952 — not square, and used for all three
 * of the iOS icon, the Android adaptive foreground and the web favicon. Every
 * platform resolves that by stretching or cropping, each differently, and none
 * of them warns: the first sight of the result is on a device, and by then the
 * build has already been handed to somebody.
 *
 * This reads the PNG header directly rather than adding an image library. The
 * dimensions live in the IHDR chunk, which is fixed at bytes 16–24 of every
 * valid PNG, so the parse is four bytes twice and cannot drift.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import app from '../../app.json';

const root = join(__dirname, '..', '..');

function pngSize(relativePath: string): { width: number; height: number; hasAlpha: boolean } {
  const buffer = readFileSync(join(root, relativePath));

  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(buffer.subarray(12, 16).toString('ascii')).toBe('IHDR');

  // Colour type 4 is greyscale+alpha and 6 is RGBA; 0, 2 and 3 carry no alpha
  // channel. iOS rejects an icon that has one.
  const colourType = buffer.readUInt8(25);

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    hasAlpha: colourType === 4 || colourType === 6,
  };
}

describe('app icons', () => {
  it('ships a square icon at the size every platform downscales from', () => {
    const icon = pngSize(app.expo.icon);

    expect(icon.width).toBe(icon.height);
    // 1024 is what the App Store requires and what Expo generates the rest of
    // the set from. Larger is wasted bytes in every build; smaller is upscaled.
    expect(icon.width).toBe(1024);
  });

  it('the iOS icon carries no alpha channel', () => {
    // A transparent icon is rejected at submission, which is the slowest
    // possible moment to discover it.
    expect(pngSize(app.expo.icon).hasAlpha).toBe(false);
  });

  it('ships a square Android adaptive foreground', () => {
    const foreground = pngSize(app.expo.android.adaptiveIcon.foregroundImage);

    expect(foreground.width).toBe(foreground.height);
    expect(foreground.width).toBe(1024);
  });

  it('the adaptive foreground keeps its alpha, and a background is declared', () => {
    // The launcher masks the foreground to its own shape and paints
    // `backgroundColor` behind it. An opaque foreground would show its own
    // corners through the mask.
    expect(pngSize(app.expo.android.adaptiveIcon.foregroundImage).hasAlpha).toBe(true);
    expect(app.expo.android.adaptiveIcon.backgroundColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('does not point any icon at the in-app logo', () => {
    // The logo is artwork with its own aspect ratio, drawn inside the app. It
    // was serving as all three icons, which is how the wrong shape shipped.
    const configured = [
      app.expo.icon,
      app.expo.android.adaptiveIcon.foregroundImage,
      app.expo.web.favicon,
    ];

    for (const path of configured) {
      expect(path).not.toMatch(/lenterra-logo\.png$/);
    }
  });
});
