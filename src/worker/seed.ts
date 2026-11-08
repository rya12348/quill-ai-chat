// A sample conversation for the local development user, so the app has
// something to show before an API key is configured. It is only ever written
// in development mode (see routes/account.ts); real accounts start empty.

import { DEFAULT_MODEL } from '../shared/config'
import { id, now, titleFrom } from './db'

export const WELCOME_CONVERSATION_ID = 'welcome'

const turns: [string, string][] = [
  [
    'How do I make cold brew coffee at home?',
    `Cold brew is mostly patience. You need coarse-ground coffee, cold water and 12 to 18 hours.

**Ratio**: start with 1 part coffee to 8 parts water by weight for a concentrate (for example 100 g coffee to 800 g water), then dilute 1:1 with water or milk when serving.

**Steps**

1. Grind the coffee coarse, like rough sea salt. A fine grind turns bitter and is hard to filter.
2. Combine coffee and cold water in a jar, stir until every ground is wet, and cover.
3. Steep in the fridge for 12 to 18 hours. Longer is stronger, not better; past 24 hours it goes flat.
4. Strain through a fine sieve lined with a paper filter or cheesecloth. Do not press the grounds.
5. Keep the concentrate in a sealed bottle in the fridge.

If it tastes thin, use more coffee next time rather than steeping longer.`,
  ],
  [
    'How long does the concentrate keep?',
    `About **two weeks** in a sealed container in the fridge. It is best in the first week; after that it slowly loses its brightness and picks up a flat, cardboard note.

Two things shorten its life: leaving grounds in it (strain fully) and storing it at room temperature. Once you dilute with milk, treat it like the milk and drink it within a couple of days.`,
  ],
]

export function seedStatements(db: D1Database, owner: string) {
  // Dated yesterday, so it does not count toward today's replies.
  const start = now() - 26 * 60 * 60_000
  const content = turns[0]![0]
  const statements = [
    db
      .prepare(`INSERT INTO conversations (id, owner_sub, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(WELCOME_CONVERSATION_ID, owner, titleFrom(content), DEFAULT_MODEL, start, start + turns.length * 2 * 60_000),
  ]
  turns.forEach(([question, answer], i) => {
    const at = start + i * 2 * 60_000
    statements.push(
      db
        .prepare(`INSERT INTO messages (id, owner_sub, conversation_id, role, content, model, created_at) VALUES (?, ?, ?, 'user', ?, NULL, ?)`)
        .bind(id(), owner, WELCOME_CONVERSATION_ID, question, at),
      db
        .prepare(`INSERT INTO messages (id, owner_sub, conversation_id, role, content, model, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, ?)`)
        .bind(id(), owner, WELCOME_CONVERSATION_ID, answer, DEFAULT_MODEL, at + 9_000),
    )
  })
  return statements
}
