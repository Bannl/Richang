# 日常 Rìcháng

I am creating Rìcháng with the goal of learning the 2,000 most common words of Taiwanese Mandarin while playing a
video game.

Rìcháng (日常, "everyday life") teaches Taiwan Mandarin both ways: by ear, with Taiwanese voices, and in writing,
in traditional characters. The 2,000 words come roughly in order of use, from the most common to the least common,
in six tiers (100, 200, 400, 600, 1,000 and 2,000 words). You learn them by playing a roguelike deckbuilder game, in
which every word is a card: you build a collection (deck) of Word cards, and unlock new ones as you progress.

**Disclaimer concerning AI**: Rìcháng has been made with the help of Claude AI to write the code, and to establish
the list of words, the dialogues and the translations. Generative AI has been used to create the character portraits
(Google Gemini) and the voiced dialogue (speech synthesis with CosyVoice 3, using Mozilla Common Voice zh-TW 27.0 as
the source of voice recordings). The backgrounds behind the portraits are real photos taken by photographers, listed in
[CREDITS.md](CREDITS.md) (CC0, public domain, CC BY 2.0 / 4.0, CC BY-SA 2.0 / 3.0 / 4.0). I'd love to replace every
AI asset made for Rìcháng with assets made by people, so [donations](https://ko-fi.com/samuelmonceau) would be used to
pay artists and voice actors.

## How it plays

Rìcháng presents itself as a roguelike deckbuilder, where every 'run' is a journey in which you choose your path
through everyday life situations. A tutorial is available in-game to learn the mechanics.

## TT File Format as a proof of concept

The voices are stored as TT files: one Ogg Opus file per character, and two for the player (a female and a male
voice), each line a segment with its name and its metadata. The game is the first real example of the [TT File Format](https://github.com/Bannl/tt-file-format).

## Credits

| What | Source | Licence |
|---|---|---|
| Photos of the places | Wikimedia Commons: 35 photos by 25 photographers, listed in [CREDITS.md](CREDITS.md) | CC0, public domain, CC BY 2.0 / 4.0, CC BY-SA 2.0 / 3.0 / 4.0 |
| Speech synthesis | CosyVoice 3 (Fun-CosyVoice3-0.5B), FunAudioLLM | Apache 2.0 |
| Voice recordings | Mozilla Common Voice zh-TW 27.0 | CC0 |
| Portraits | generated with Google Gemini | |
| Stroke order | Hanzi Writer; Make Me a Hanzi | MIT; Arphic Public License |
| Dictionary (checks only) | CC-CEDICT | CC BY-SA 4.0 |
| Font | Nunito | SIL Open Font License |

## Privacy

Rìcháng collects no personal data: no account, no advertising, no analytics, no tracking. Your progress stays on your
device. Details: [PRIVACY.md](PRIVACY.md).

## License

Rìcháng is free software by Nextale Audio. Its code is under the GNU GPL, version 3 or later, and any version you
share must keep the credit "Rìcháng by Nextale Audio"; the code of the TT File Format is also under the MIT License.
The portraits, voices, word list, dialogues and translations made for the game are under CC BY-SA 4.0. The photos
and other third-party content keep their own licences. Details: [COPYRIGHT.md](COPYRIGHT.md).

Building, data pipeline and architecture (in French): [DEVELOPMENT.md](DEVELOPMENT.md).
