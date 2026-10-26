# Haunted pumpkin patch visual direction

The game is a playful Halloween video game set in Jebediah Crow's pumpkin patch. The presentation uses dark, quiet illustrated environments, big spooky cartoon headings, readable game information, and very limited bright accents.

## Visual rules

- Use midnight plum and charcoal for the setting; off-white for primary information; muted lavender, teal, and copper for supporting details. Sample new colors from the supplied project art.
- Keep the middle of the scene open. Branches, vines, and pumpkins belong at the edges. Rich character art can be the focal point; surrounding panels stay restrained.
- Preserve Jebediah's face, hat, leaf, plaid shirt, blue overalls, and straw details. New expressions should suit his role as a friendly guide.
- Use the locally hosted Creepster font for headings and ordinary sans-serif text for instructions, inputs, names, and scores. Keep all live text in HTML.
- Use a small shared SVG icon family and the same matte panel treatment throughout. Color marks have both a text label and a contrasting border.
- Keep QR SVGs exact. Illustrations and frames sit outside the white scan canvas and its quiet zone. Print layouts use white paper and dark ink with limited color marks.
- Motion stays slow and subtle, and respects `prefers-reduced-motion`.

## Assets

| File | Purpose |
| --- | --- |
| `public/assets/patch-night.webp` | Shared quiet night background with trees and pumpkins at the edges |
| `public/assets/jebediah-welcome.webp` | Transparent Jebediah holding the project's yellow scanner; home and intro |
| `public/assets/jebediah-alert.webp` | Finale reaction on intro and target screens |
| `public/assets/jebediah-victory.webp` | Results reaction on intro and target screens |
| `public/assets/ghosts-trio.webp` | Three matching ghost poses in an equal-column transparent atlas; digital and printed targets |
| `public/assets/atmosphere-ghost.webp` | Clipart version of the office gauze ghost, streamers, and pumpkin lantern |
| `public/assets/scanner.webp` | Optimized existing scanner illustration |
| `public/assets/pumpkin.webp` | Optimized existing pumpkin illustration for the empty leaderboard |
| `public/icons.js`, `public/favicon.svg` | Code-native interface icons and ghost mark |
| `public/fonts/creepster-regular.ttf` | Locally hosted display font |

The Creepster font comes from the official `google/fonts` repository, `ofl/creepster`, and is distributed with its SIL Open Font License in `public/fonts/OFL-Creepster.txt`. The illustration prompts are preserved in [ART-PROMPTS.md](ART-PROMPTS.md).

## Content and identity

The October 26 wording revisions are applied across the header, home, setup, scanner, intro, leaderboard, targets, print pages, and game messages. Intentional retained labels such as “Wand station,” “Wand test,” and the “Wand tested!” scan feedback follow the supplied copy.

| Computer | Scanner |
| --- | --- |
| `joshdesk` | Black |
| `barbdesk` | White |
| `center` | Blue |
| `studentprimary` | Red |
| `north` | Yellow |
| `east` | Green |

Computer selection fills its fixed scanner color. The API validates the pair. Existing assignments from before the rename persist until staff release them or reset the lobby.

## Delivery and checks

HTML entry pages use `Cache-Control: no-cache`; changed app and stylesheet URLs carry a release version so browser refreshes receive the new presentation. Artwork and fonts are served locally with the application.

The production build and 20 automated game/API/server checks pass. Additional DOM checks exercised 36 page/state combinations, all six scanner selections, stable name-entry fields, staff-control visibility, and print counts of 15 ghosts, six badges, and one test target. QR files were checked against the repository baseline and were not modified. Generated image transparency and dimensions were inspected.

Browser rendering and physical scanner validation remain follow-up checks: the workspace has no browser executable, and the Chromium download was blocked. DOM checks do not establish the visual appearance or scanner range on real devices.
