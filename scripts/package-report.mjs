// Small build helper kept separate so platform packaging can share web output.
import { execFileSync } from 'node:child_process';

execFileSync('npx', ['cap', 'sync', 'android'], { stdio: 'inherit' });
