# Copyright and licences

Rìcháng, copyright (C) 2026 Nextale Audio.

## Code

The code of Rìcháng is free software: you can redistribute it and/or modify it under the terms of the GNU General
Public License, version 3 or (at your option) any later version ([LICENSE](LICENSE)). It comes with no warranty.

Additional term (GNU GPL version 3, section 7(b)): a version of Rìcháng that you convey, modified or not, must keep
the author attribution "Rìcháng by Nextale Audio" in the Appropriate Legal Notices it displays, for example in its
credits or about screen.

The code of the TT File Format in Rìcháng is also available under the MIT License ([LICENSE-MIT](LICENSE-MIT)), at
your choice, so that any game or tool can read and write TT files with it:

- `src/platform/tt.ts`, the reader;
- `scripts/lib/ogg.mjs`, the Ogg pages, packets and comments;
- `scripts/build-voices-tt.mjs`, the writer.

## Content made for the game

The content made for Rìcháng is licensed under the Creative Commons Attribution-ShareAlike 4.0 International licence
([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)), with the attribution "Rìcháng by Nextale Audio":

- the character portraits (`src/assets/portraits/`);
- the voice lines (`public/voices/`);
- the word list with its translations, notes and examples, the dialogues and the scenes (`data/`,
  `src/data/tutorial.json`, `src/data/generated/words.json`, `dialogues.json`, `scenes.json`, `themes.json`, and
  `Doublage - Répliques des voix.md`);
- the icon and the splash screens (`assets/`).

## Third-party content

Each keeps its own licence:

- the photos of the places (`src/assets/bg/`), from Wikimedia Commons, under CC0, public domain, CC BY or CC BY-SA:
  each one is listed with its author and licence in [CREDITS.md](CREDITS.md);
- the stroke data of the characters (`src/data/generated/hanzi-*.json`), from Make Me a Hanzi through Hanzi Writer
  (`hanzi-writer-data`): Arphic Public License;
- the libraries the game uses (React, Hanzi Writer, Electron, Capacitor, the Nunito font...), installed by `npm
  install`: their own licences, which come with them.
