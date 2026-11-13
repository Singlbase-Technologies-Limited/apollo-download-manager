#!/usr/bin/env node
// `pnpm guide`: writes the in-app guide's data (#354) from the user guides in docs/user/, to
// src/features/help/guide.generated.json. A Vitest test (scripts/guide-lib.test.mjs) fails when the
// committed file is out of date, so run this after editing a guide.
import { writeFileSync } from 'node:fs';
import { CHANGELOG_OUT, changelogData, GUIDE_OUT, guideData } from './guide-lib.mjs';

writeFileSync(GUIDE_OUT, guideData());
console.log(`wrote ${GUIDE_OUT.pathname}`);
// The What's new window's changelog (#496), from CHANGELOG.md.
writeFileSync(CHANGELOG_OUT, changelogData());
console.log(`wrote ${CHANGELOG_OUT.pathname}`);
