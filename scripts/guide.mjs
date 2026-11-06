#!/usr/bin/env node
// `pnpm guide`: writes the in-app guide's data (#354) from the user guides in docs/user/, to
// src/features/help/guide.generated.json. A Vitest test (scripts/guide-lib.test.mjs) fails when the
// committed file is out of date, so run this after editing a guide.
import { writeFileSync } from 'node:fs';
import { GUIDE_OUT, guideData } from './guide-lib.mjs';

writeFileSync(GUIDE_OUT, guideData());
console.log(`wrote ${GUIDE_OUT.pathname}`);
