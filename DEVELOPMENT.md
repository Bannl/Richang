# 日常 Rìcháng — apprendre le chinois du quotidien (Taïwan)

Application de cartes (flashcards) pour apprendre le mandarin **traditionnel tel qu'il se pratique à Taïwan**, par paliers de fréquence : 100, 200, 400, 600, 1000, 2000 mots, plus un 7e palier de 567 mots : ceux des dialogues hors des 2000 (2567 cartes en tout). Une seule base de code web (TypeScript + React) empaquetée pour **Windows** (Electron), **Android** et **iOS** (Capacitor).

## Ce que fait l'app

**Au premier lancement, un tutoriel** apprend à jouer. On trace son premier mot, 我 (je, moi), qui rejoint le deck. Puis le propriétaire se présente (« 你好，我是你的房東。 ») : on glisse 我 dans le trou de sa réplique, puis dans sa propre réponse (« 對不起，我聽不懂。 »). Des bulles montrent le geste et expliquent le bouton qui répète la réplique, puis les vies. L'écran s'assombrit enfin sur la voix intérieure du joueur. Le tutoriel peut être passé, et se rejoue depuis Réglages › Apprentissage.

**C'est un jeu** : un roguelite deckbuilder où le deck est fait de cartes Mots. On débloque une carte en la traçant ; avec 10 cartes on lance une **aventure en journées**. Chaque journée est une carte à embranchements (nœuds rencontre / élite / repos ; 34 situations couvrant les 2567 mots) qui se termine par un **événement du soir**, une situation tirée parmi celles jouables, jamais la même que la veille. On enchaîne les journées tant qu'il reste des vies (5 ; une nuit de sommeil en rend une, une halte de repos deux) ; le **score** est le nombre de journées réussies, et le record s'affiche à l'accueil. Au fil des journées, la difficulté monte (`src/game/progression.ts`) : rencontres plus longues (une seule scène, jamais deux collées), scènes de niveau plus élevé (niveau 1 à 5 : quintiles de complexité du corpus, d'après la longueur des répliques et la rareté des mots), plus de mots à placer par réplique, et les mots très fréquents écartés des trous. Chaque rencontre est un dialogue dans une situation du quotidien à Taïwan : les répliques arrivent en cartes-mots au rythme de la voix, et l'on remplit leurs trous en glissant des cartes de sa main (5 cartes de même taille alignées en bas, recomplétée à chaque réplique ; un clic met une carte en avant avec ses informations, seul le glisser-déposer la joue). Une case vide montre un « ? » par caractère du mot manquant. Un grand espace au-dessus de l'adversaire est réservé aux futures illustrations. Bonne carte : on avance ; mauvaise : −1 PV. En haut à droite, le portrait de l'interlocuteur (employé de supérette, propriétaire, médecin…) avec le sujet de la discussion, l'avancement, les PV et les répétitions restantes ; dessous, une fenêtre de conversation garde la trace du dialogue : une fois une réplique terminée, ses mots s'envolent des cartes vers une bulle. Après une rencontre, on apprend une nouvelle carte (choix parmi 3). Quatre difficultés : Newcomer (cartes complètes), Seasoned (symboles + pinyin), Resident (symboles seuls), Native (plus de main : le mot manquant s'écrit à la main dans la phrase, trait par trait). La réplique en cours peut être répétée 3 fois par rencontre. Un écran **Entraînement** permet de revoir ses cartes avec toutes leurs informations et de tracer chaque caractère dans une case vide, le modèle animé à côté.

Deux autres modes sont dans le menu :
- **Situations** : on choisit une situation jouable avec son deck et l'on joue une de ses conversations en entier (pas la même deux fois de suite), sans toucher à l'aventure en cours (`src/game/drill.ts`, rencontre fictive sur l'écran de combat, comme le tutoriel).
- **Défi d'écriture** : les mots du deck arrivent un par un, à écrire de mémoire (pinyin, sens et voix en invite). Chaque erreur de trait coûte une vie, sur 5 ; le score est le nombre de mots écrits, avec un record.

**Étoile de maîtrise** : un mot tracé 10 fois d'affilée sans aucune erreur, tous modes confondus (défi d'écriture, écriture en combat Native, Entraînement ; pas le tracé sur pointillés quand on apprend la carte), reçoit une étoile dans le coin de sa carte. Une erreur remet la série à zéro ; l'étoile, une fois gagnée, reste (`src/core/mastery.ts`).

- **Paliers** : les mots sont classés par utilité/fréquence dans 6 paliers cumulés (1-100, 101-200, 201-400, 401-600, 601-1000, 1001-2000), plus le palier 7 (2001-2567, « 2000+ » dans le deck) : les mots des dialogues qui n'étaient pas parmi les 2000, classés par fréquence dans les dialogues ; ainsi chaque caractère de chaque réplique appartient à une carte, sauf les noms de personnes et 14 thèmes (grammaire, pronoms, nombres & temps, verbes, adjectifs, personnes, nourriture, lieux & transport, achats, maison, travail & études, corps & santé, nature, expressions).
- **Cinq exercices** par mot : découverte (le mot apparaît en pointillé, chaque caractère est animé trait par trait dans l'ordre et le sens, puis tracé au doigt, stylet ou souris avant de continuer), lecture (caractères → sens), écoute (audio → sens), écriture (tracé de mémoire, corrigé par Hanzi Writer), prononciation (modèle vocal, enregistrement, ré-écoute, et vérification par reconnaissance vocale sur Android et iOS).
- **Répétition espacée** (variante de SM-2) par mot *et* par compétence. Un mot est « maîtrisé » quand ses quatre compétences ont un intervalle ≥ 21 jours.
- **Couleur par thème** pendant l'apprentissage ; une fois le mot maîtrisé, la carte devient neutre pour ne plus s'appuyer sur la couleur.
- **Langue de l'interface et des explications** : anglais (par défaut) ou français — libellés, sens, notes d'usage et traductions des exemples.
- Pinyin et zhuyin (ㄅㄆㄇㄈ) affichables séparément, police Kai (manuscrite) optionnelle, mode sombre, export/import de la progression.

## Commandes

```bash
npm install            # dépendances
npm run dev            # serveur web de dev (http://localhost:5173)
npm run electron:dev   # Windows : Vite + Electron avec rechargement à chaud
npm run electron:build # Windows : installeur NSIS + portable dans release/
npm run android:apk    # Android : build web + sync + APK de debug (android/app/build/outputs/apk/debug/)
npm run android:open   # ouvre le projet dans Android Studio
npm run ios:sync       # iOS : build web + synchronisation du projet Xcode (ios/App) ; compilation sur un Mac, voir « iOS »
npm run typecheck      # vérification TypeScript
```

Prérequis Android : Android Studio (SDK + JDK intégré). Le script `scripts/android-build.mjs` utilise `JAVA_HOME`/`ANDROID_HOME` s'ils sont définis, sinon le JDK d'Android Studio et `%LOCALAPPDATA%\Android\Sdk`.

## Données (pipeline)

| Étape | Fichier | Rôle |
| --- | --- | --- |
| 1 | `data/master-t1-t4.txt` | liste maîtresse des 600 premiers mots, par palier et thème (éditable à la main) |
| 2 | `data/candidates/<thème>.txt` | propositions pour les paliers 5-6, par thème |
| 3 | `node scripts/merge-candidates.mjs` | fusion + dédoublonnage → `data/master-t5-t6.txt`, `data/master-all.json` |
| 4 | `data/parts/part-N.json` → `data/enriched/part-N.json` | enrichissement (pinyin, catégorie, sens FR, note, exemple) |
| 4b | `data/enriched-en/part-N.json` | sens, notes et exemples en anglais (mêmes rangs) |
| 5 | `npm run data:validate` | contrôle (syllabes pinyin, caractères simplifiés, exemples, croisement CC-CEDICT) → `data/words-final.json` + `data/validation-report.txt` |
| 5b | `npm run data:dialogues` | valide `data/dialogues/*.json` (dialogues par situation) → `data/dialogues-final.json` |
| 5c | `node scripts/validate-scenes.mjs` | valide `data/scenes/*.json` (scènes : conversations cohérentes par situation, de 4 à 12 répliques) → `data/scenes-final.json` + `data/scenes-report.txt` |
| 5d | `node scripts/check-scenes.mjs <fichiers>` | contrôle des fichiers de scènes avant de les ajouter : forme, caractères traditionnels, pinyin aligné, alternance (le personnage commence), au moins un mot du jeu par réplique, identifiants uniques, niveau estimé ; n'écrit rien |
| 5e | `node scripts/normalize-scene-pinyin.mjs [--write]` | harmonise dans toutes les scènes la lecture de quelques mots (法國 fà guó, 塞車 sāi chē, 第一 dì yī, 星期 xīng qí, 垃圾 lè sè, 謝謝 xiè xie, 炸 zhà, 轉下來 zhuàn xià lái) |
| 5f | `node scripts/normalize-punct.mjs [--write]` | ponctuation pleine chasse (，？！；：) dans le chinois des répliques et des exemples des cartes |
| — | `node scripts/dub-status.mjs [--out <fichier>]` | état du doublage : répliques jamais enregistrées ou modifiées depuis l'enregistrement (liste des prises à doubler pour CosyVoice) ; `node scripts/doc-doublage.mjs` régénère le script de doublage avec ces marques |
| 6 | `npm run data:build` | génère `src/data/generated/` : `words.json` (zhuyin dérivé du pinyin), `scenes.json` et les données de traits par palier (`hanzi-tN.json`) |

Pour corriger un mot, éditer `data/enriched/part-N.json` ou `data/enriched-en/part-N.json` (ou ajouter une prononciation dans `data/pinyin-overrides.json`) puis relancer les étapes 5 et 6. Les mots du palier 7 (rangs 2001 et suivants) sont dans `part-9.json` et dans `data/master-all.json` (`tier: 7`) ; les numéros des cartes ne changent jamais (ils identifient la progression du joueur) : un nouveau mot prend le numéro suivant. `data/themes.json` définit les thèmes et leur teinte (OKLCH).

Conventions pinyin : lectures taïwanaises (星期 xīng qí, 法國 fà guó, 垃圾 lè sè, 炸 zhà…), sandhi de 一/不 écrit tel qu'il se prononce (yì diǎn, yí xià, bú cuò), sauf 一 ordinal qui garde le premier ton (第一次 dì yī cì). **Tons pleins** pour toute syllabe qui porte du sens, comme on parle à Taïwan (晚上 wǎn shàng, 休息 xiū xí, 東西 dōng xī, 認識 rèn shì, 時候 shí hòu) ; ton neutre seulement pour les particules (了 的 得 著 嗎 呢 吧 啊 喔 們 麼), le classificateur 個, les suffixes 子 et 頭, les redoublements (媽媽, 謝謝) et 鑰匙. Les cartes suivent `data/pinyin-overrides.json` ; les phrases (exemples des cartes, répliques) sont harmonisées par `node scripts/normalize-scene-pinyin.mjs --write` d'après `scripts/lib/readings.mjs`.

Ponctuation : le chinois des phrases (répliques, exemples des cartes) s'écrit en **pleine chasse**, comme à Taïwan : ，。？！；：. `node scripts/normalize-punct.mjs --write` convertit les signes latins (, ? ! ; :), sauf entre deux chiffres. `validate-scenes`, `check-scenes` et `validate-words` signalent une erreur s'il en reste. Le doublage n'en dépend pas : le jeu compare seulement les caractères chinois d'une réplique à ceux de son enregistrement.

**Scènes (dialogues)** : `data/scenes/<situation>__N.json` (première série), `__v2.json` (8 scènes par situation : 3 de 4 répliques pour les premières journées, 3 de 8, 2 de 10 à 12), `__cov.json` (scènes qui font apparaître les mots que les autres n'emploient pas : chacun des 2000 premiers mots est dans au moins une réplique). Le joueur est un Français installé à Taïwan, dont le genre ne se voit jamais (ni en chinois ni en français). Le jeu découpe chaque réplique en prenant d'abord le plus long mot de la liste ; quand ce découpage ferait un trou trompeur (mot de la liste lu dans un autre sens que sa carte : 天氣好的時候 n'est pas 好的, 電影 n'est pas 電 « électricité »), une exception dans `src/data/segment-splits.json` donne les bons morceaux (un morceau préfixé de `~` reste du texte, jamais un trou), utilisée par le jeu (`src/game/lines.ts`) et par les scripts de contrôle (`scripts/lib/segment.mjs`). Le zhuyin est dérivé du pinyin. Quatre caractères n'ont pas de tracé dans Hanzi Writer (嬤 痠 齁 嚐) : ils sont ignorés en mode écriture.

## Mise à l'échelle

L'interface est proportionnelle à la fenêtre : l'unité CSS `--u` vaut 1 px pour une fenêtre de 1400×900 et suit ensuite la plus petite des deux dimensions (bornée). Toutes les tailles (cartes, polices, espacements) sont exprimées en multiples de `--u` ; côté JavaScript, `useUnit()` fournit le même facteur pour la géométrie du carrousel et des canvas.

## Architecture

```
src/core        types, répétition espacée (srs.ts), construction de session, mise à jour de l'état
src/game        jeu : types, génération de carte (map.ts), phrases à trou (lines.ts), situations, état du run et des journées (run.ts), règles de difficulté par journée (progression.ts), mode Situation (drill.ts), tutoriel (tutorial.ts)
src/platform    stockage (Electron/Capacitor/localStorage), synthèse vocale, reconnaissance vocale, enregistreur
src/modes       Intro, Read, Listen, Write, Speak
src/screens     Home (camp), Learn, MapScreen, Battle, RunScreens (récompense/repos/fin de journée/fin de partie), Situations, WritingChallenge, Practice, Words (deck), Settings, Tutorial
src/ui          composants (carte colorée, cartes Mots et main en éventail, canvas Hanzi Writer, choix, icônes)
electron/       processus principal (protocole app://, stockage fichier) et preload
android/        projet Android Studio (Capacitor)
ios/            projet Xcode (Capacitor, CocoaPods), compilé sur un Mac
scripts/        pipeline de données, lanceurs Electron/Android, paquet et build iOS (scripts/ios/)
```

## Notes

- **Doublage** : les répliques des scènes sont enregistrées, dans un fichier TT Ogg Opus par personnage et un par voix du joueur (`public/voices/`, construits par `node scripts/build-voices-tt.mjs .cache/dub-wav [--verify]`). Elles sont jouées telles qu'enregistrées, à leur vitesse d'origine (`src/platform/voices.ts`) ; le réglage de vitesse ne concerne que la synthèse vocale. Une réplique modifiée après son doublage ne rejoue pas l'ancien enregistrement : le jeu compare son texte au champ `TEXT_ZH` du segment et passe à la synthèse vocale s'ils diffèrent. Les nouvelles scènes parlent aussi par la synthèse jusqu'à leur doublage.
- **Voix** (doublage) : toutes viennent de locuteurs taïwanais de Mozilla Common Voice zh-TW 27.0 (CC0), une par personnage et deux pour le joueur, clonées avec CosyVoice 3. Les références (extraits non retouchés, silences de bord coupés) et leur phrase sont dans `.cache/commonvoice/voices.json` ; choix par `pick_voices.py`, et `pick_new_voices.py` pour remplacer une voix (candidats à écouter). Pour redoubler une voix : `python dub_gpu.py ../commonvoice/voices.json --voices <voix> [--shard k/N]` dans `.cache/cosyvoice` (k de 1 à N ; carte graphique AMD : environnement `.cache/cosyvoice-rocm-venv`, PyTorch ROCm, `NOMIOPEN=1`, supprimé après chaque doublage et recréé par `.cache/rocm-setup.sh`), ou `dub_all.py` sur le processeur (`.cache/cosyvoice-venv`). Pour les répliques nouvelles ou modifiées : `node scripts/dub-status.mjs --out <liste>`, puis `--keys <liste>`. Lecture imposée d'un caractère à plusieurs lectures : `.cache/cosyvoice/pron.json` (mot → même mot avec le pinyin entre crochets, initiale puis finale : « 轉下來 » → « [zh][uàn]下來 », syntaxe de CosyVoice 3). Puis le contrôle `dubcheck.py`, les reprises des prises ratées dans deux autres modes (`.cache/dub-retake.sh` : `NORMTEXT=1 CALM=1`, et le mode normal ; `--keys <liste>`, `OUT=<dossier>`), le choix `dubpick.py`, et la reconstruction `node scripts/build-voices-tt.mjs .cache/dub-wav --only <fichiers> --verify`.
- **Format des voix (TT File Format 0.3)** : chaque réplique est un segment du fichier, avec son nom (`<scène>-<ligne>-<n|f|m>`) et toutes ses métadonnées (USER, champs de la réplique, ORIGIN). La liste des segments est une table JSON sur une ligne, dans le commentaire `TT_SEGMENT_TABLE` (section 11.5 de la spec) : le nom de chaque élément est écrit une fois, les valeurs communes à toutes les répliques du fichier aussi (`DEFAULTS`). Les répliques sont mises bout à bout sans silence entre elles, sauf ce qui manque à leurs propres bords calmes (60 ms après la voix d'une réplique, 20 ms avant celle de la suivante), avec 100 ms au début et à la fin du fichier. Ainsi chaque fichier pèse moins que les mêmes répliques en fichiers Opus séparés avec les mêmes métadonnées (section 12). Contrôle : `py -I -B <kit>/make_tt_spec_samples.py --validate public/voices/<fichier>.opus` (attendu : `RESULT PASS`, et `lighter` sur la ligne `weight`). Le lecteur `src/platform/tt.ts` lit la table, et encore la liste XML (`TT_SEGMENT_LIST`) des fichiers 0.2 ; il ne décode que les paquets de la réplique demandée.
- **Tutoriel** : sa scène (`src/data/tutorial.json`) n'entre pas dans les runs. Ses deux répliques sont doublées comme les autres et rangées en fin de fichier, dans celui du propriétaire (`landlord.opus`) et dans ceux du joueur. La scène réutilise l'écran de combat sur une rencontre fictive (`src/game/tutorial.ts`, `src/screens/Tutorial.tsx`) : le vrai deck et un run en cours ne sont pas touchés.
- **Voix** : sans doublage, la synthèse vocale prend le relais ; chaque personnage parle avec une voix d'homme ou de femme selon son portrait (Windows : Microsoft Zhiwei pour les hommes, Hanhan/Yating pour les femmes ; Android : voix Google/Samsung reconnues par leur nom, sinon hauteur de voix modifiée ; iOS : voix Apple, dont Mei-Jia pour Taïwan). Choix manuel de la voix des hommes, des femmes et de tes répliques, et vitesse de la synthèse, dans Réglages › Audio.
- **Annotation phonétique** (option, désactivée par défaut) : bopomofo, pinyin, Tongyong ou Wade-Giles à côté de chaque mot (`src/core/phonetics.ts`, contrôle : `node scripts/check-phonetics.mjs`). Le bopomofo s'affiche comme dans les manuels de Taïwan, partout, cartes comprises : en petit, vertical, à droite de chaque caractère et centré sur sa hauteur, ton au coin supérieur droit du dernier symbole (W3C clreq 5.5.3) ; `src/ui/Phonetic.tsx`.
- **Plateaux de jeu** : un par lieu (maquettes Claude Design). En combat, la matière du lieu couvre l'écran (bois, carrelage, sable…), avec une lumière, un grain et une vignette ; un tapis en creux reçoit la main, avec un filet et le sceau rouge du lieu (夜市, 捷運…) ; les panneaux prennent une teinte de la matière. Matières en CSS seul dans `src/boards.css` (`.battle[data-board="<lieu>"]`), sceaux et bords des tapis dans `src/game/boards.ts`.
- **Photos des lieux** : Wikimedia Commons (CC0, domaine public, CC BY, CC BY-SA), une par situation, importées par `node scripts/import-backgrounds.mjs <dossier>` dans `src/assets/bg/` avec `credits.json` ; attributions affichées dans Réglages.
- **Portraits** : illustrations générées avec Google Gemini, 6 par personnage (34 personnages), dans `src/assets/portraits/<situation>-<émotion>.webp` (émotions : neutral, happy, shocked, confused, angry, curious ; import et détourage du fond blanc ou magenta : `node scripts/import-portraits.mjs <dossier>`), affichées par `src/ui/Portrait.tsx`. Galerie de développement : `/?gallery`. En combat, une bonne carte réjouit le personnage ; une mauvaise le laisse un instant perplexe ou choqué, en alternance, avec une bulle « ? » ou « !? » près de la tête (réactions par trait : `TRAIT_REACTIONS`).
- **Menus** : même langage que le jeu.
  - Le fond est une table en laque de jade, avec le treillis doré des dos de cartes en filigrane : claire ou sombre selon le thème (`--table` dans `src/styles.css`). Les écrans à photo ont un voile jade.
  - Les réglages et le deck sont posés sur une carte de menu au cadre double des panneaux.
  - Boutons : papier (thème clair) ou laque noire (thème sombre), avec un filet intérieur vermillon ou doré. Le bouton principal est en laque rouge porte-bonheur à filet doré (`--lacquer`). Les boutons ronds sont des pièces, les étiquettes des tickets, les interrupteurs ont un curseur en pièce d'or.
  - Logo : 日常 dans un sceau de jade, comme l'icône de l'app. Sceaux vermillon en kai sur les liens du camp (牌 練 設).
  - Chaque écran a son titre chinois en kai (設定, 練習…), passé à `TopBar` par `zh`, et chaque section le sien (`SectionTitle`).
  - Captures d'écran de contrôle (Edge sans fenêtre, thèmes clair et sombre) : `node .cache/ui-lab/shoot.mjs <dossier> [--size 800x360] [--screens home,settings,…]`, avec le serveur Vite lancé.
- **Icône** : un sceau de jade (laque verte, treillis doré, filet d'or, 日 crème en relief, dessiné en rectangles, sans police). `node scripts/make-icons.mjs` la génère :
  - Windows : `build/icon.png`, `build/icon-256.png`, `build/icon.ico` (16 à 256 px) ;
  - Android : icônes des 6 densités, anciennes et adaptatives (fond + premier plan), et les 26 écrans de démarrage, l'icône sur un dégradé de jade clair ou sombre (`-night`) ;
  - sources de `@capacitor/assets` dans `assets/`. Le projet iOS garde l'ancienne icône tant qu'on ne la régénère pas depuis `assets/`.
  - `--preview <dossier>` produit seulement quelques images d'essai.
- **Polices** : interface en Nunito (SIL OFL, `@fontsource-variable/nunito`) ; caractères chinois avec les polices du système, et le kai (標楷體 sous Windows) pour les sceaux et les titres chinois.
- **Reconnaissance vocale** : Android et iOS (plugin natif `@capacitor-community/speech-recognition`). Sur iOS, la phrase n'est rendue qu'à l'arrêt de l'écoute : `src/platform/stt.ts` suit les résultats partiels et s'arrête après 1,2 s de silence (8 s au plus). Sur Windows, la prononciation se travaille par écoute du modèle, enregistrement et auto-évaluation.
- **Données de traits** : [Hanzi Writer](https://hanziwriter.org) (MIT) et *Make Me a Hanzi* (Arphic Public License). Dictionnaire de contrôle : [CC-CEDICT](https://cc-cedict.org) (CC BY-SA 4.0), téléchargé dans `data/external/` (non versionné).

## Android

L'app tourne en **paysage** (les deux sens) dès le lancement, en plein écran immersif (barres d'état et de navigation masquées, un glissement depuis le bord les fait réapparaître un instant), avec une mise en page téléphone : bandeau compact en haut du combat, conversation en volet, carte du run horizontale.

Construire et installer : `npx vite build && npx cap sync android && node scripts/android-build.mjs assembleDebug` produit `android/app/build/outputs/apk/debug/app-debug.apk` (copié dans `release/Richang-0.1.0-android.apk`). Copier l'APK sur le téléphone (câble, Drive, mail) et l'ouvrir ; Android demande d'autoriser l'installation d'applications inconnues pour l'app qui ouvre le fichier. Téléphone branché en USB avec le débogage activé : `adb install -r release/Richang-0.1.0-android.apk`.

## iOS

**Statut (14 novembre 2026) : en pause.** Le projet iOS est prêt, et il a été compilé sur un Mac jusqu'à l'export App Store (`.ipa`). Les étapes avant l'export fonctionnent toutes :
- installation automatique de Node et de CocoaPods ;
- dépendances npm et compilation du jeu ;
- `pod install` ;
- archive.

À la reprise :
- premier envoi sur App Store Connect. Le premier essai par `altool` a été refusé à la connexion ; le mode `upload` passe maintenant par Xcode, mais n'a pas encore été essayé ;
- fiche de l'app dans App Store Connect ;
- test sur iPhone par TestFlight ;
- pour une publication, captures de l'App Store.

Même projet web, dans un projet Xcode Capacitor (`ios/App`, CocoaPods, iPhone et iPad, iOS 15 minimum), identifiant `app.richang.mobile` comme sur Android. L'app tourne en **paysage** (plein écran sur iPad, barre d'état masquée) ; les marges de l'encoche et de la barre d'accueil sont prises en compte en CSS (`env(safe-area-inset-*)`). Le son joue même en mode silencieux, sans couper la musique d'une autre app (`AppDelegate.swift`, et `navigator.audioSession` dans `src/platform/voices.ts`). Les sauvegardes exportées vont dans l'app Fichiers (Sur mon iPhone › 日常). Les voix doublées (Ogg Opus) demandent iOS 18.4 ou plus ; avant, la synthèse vocale prend le relais.

Compilation sur un Mac avec Xcode, en ligne de commande, depuis un clone du dépôt :

```bash
git clone https://github.com/Bannl/Richang.git ~/Richang     # ensuite : git -C ~/Richang pull
bash ~/Richang/scripts/ios/build_ios.sh sim       # compile et lance l'app sur un iPhone et un iPad simulés
bash ~/Richang/scripts/ios/build_ios.sh ipa       # archive + export App Store -> ~/Richang_ipa/App.ipa
bash ~/Richang/scripts/ios/build_ios.sh upload    # idem, puis envoi sur App Store Connect (TestFlight)
bash ~/Richang/scripts/ios/build_ios.sh clean     # libère de la place
```

Le script prépare tout, sans droits administrateur : Node (dans `~/.richang-node` s'il manque), les dépendances npm, CocoaPods (dans `~/.richang-gems`), puis `npm run ios:sync` et `pod install`. L'archive est faite sans signature ; l'export App Store la signe en distribution et crée le profil. L'identifiant d'équipe Apple est demandé une fois et gardé sur le Mac (`~/.richang-ios.env`), jamais dans le dépôt. L'envoi (`upload`) passe par Xcode, avec le compte Apple connecté dans Xcode (Réglages › Comptes) : aucun mot de passe n'est demandé. Numéro de build : `AAMMJJ.HHMM` par défaut, ou en deuxième argument.

**Tester sur un iPhone ou un iPad, sans publier : TestFlight.** Sur iOS, il n'y a pas d'installateur à copier sur l'appareil comme l'APK Android. L'`.ipa` du mode `ipa` est signé pour l'App Store et ne s'installe que par TestFlight ou l'App Store. Sans câble vers le Mac, TestFlight est le moyen simple.
1. Sur le Mac : `build_ios.sh ipa`. L'export enregistre l'identifiant `app.richang.mobile` dans l'équipe.
2. Sur appstoreconnect.apple.com, depuis n'importe quel navigateur, aller dans Apps › + › Nouvelle app :
   - iOS ;
   - un nom unique sur l'App Store ;
   - langue principale ;
   - bundle `app.richang.mobile` ;
   - un SKU, par exemple `richang-ios`.

   La fiche reste privée tant qu'elle n'est pas soumise à Apple.
3. Sur le Mac : `build_ios.sh upload`.
4. Dans App Store Connect, aller dans l'app › TestFlight :
   - attendre la fin du traitement du build, de quelques minutes à une heure ;
   - créer un groupe de test interne et s'y ajouter ;
   - le test interne ne passe pas par la validation d'Apple.
5. Sur l'iPhone : installer l'app TestFlight (App Store), se connecter avec le même Apple ID, puis installer Rìcháng. Un build reste installable 90 jours.

Pour l'App Store, plus tard, la politique de confidentialité est <https://github.com/Bannl/Richang/blob/master/PRIVACY.md> (aussi liée dans les Réglages de l'app).

Les réglages natifs (Info.plist, AppDelegate, icônes générées depuis `assets/icon-only.png`, version) vivent dans `ios/` et ne sont pas écrasés par `cap sync`.
