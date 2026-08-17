import * as React from 'react';
import renderer, { act } from 'react-test-renderer';

import { ThemedText } from '../ThemedText';

it(`renders correctly`, () => {
  // React 19 requires every render to sit inside `act`, even one that triggers
  // no state update. Without it `create` returns before the tree is committed
  // and `toJSON()` is null — which fails as a snapshot mismatch showing the
  // whole expected tree against `null`, rather than as anything naming the
  // cause.
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ThemedText>Snapshot test!</ThemedText>);
  });

  expect(tree.toJSON()).toMatchSnapshot();
});
