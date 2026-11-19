// Lets `bun test` run the kit's checks. The checks themselves are in scripts/check.mjs, which
// `bun run check` runs with more detail, and which can check a copy of the starter too.

import { test, expect } from 'bun:test'
import { runChecks } from '../scripts/check.mjs'

for (const { name, ok, detail } of await runChecks()) {
  test(name, () => {
    expect(ok, detail).toBe(true)
  })
}
