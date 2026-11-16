import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default [
  ...nextVitals,
  ...nextTypescript,
  {
    // Hydration intentionally restores persisted browser-local records after mount.
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
];
