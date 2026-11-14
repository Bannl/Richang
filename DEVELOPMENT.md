# 日常 Rìcháng — apprendre le chinois du quotidien (Taïwan)

Application de cartes (flashcards) pour apprendre le mandarin **traditionnel tel qu'il se pratique à Taïwan**, par paliers de fréquence : 100, 200, 400, 600, 1000, 2000 mots. Une seule base de code web (TypeScript + React) empaquetée pour **Windows** (Electron), **Android** et **iOS** (Capacitor).

## Ce que fait l'app

**Au premier lancement, un tutoriel** apprend à jouer. On trace son premier mot, 我 (je, moi), qui rejoint le deck. Puis le propriétaire se présente (« 你好，我是你的房東。 ») : on glisse 我 dans le trou de sa réplique, puis dans sa propre réponse (« 對不起，我聽不懂。 »). Des bulles montrent le geste et expliquent le bouton qui répète la réplique, puis les vies. L'écran s'assombrit enfin sur la voix intérieure du joueur. Le tutoriel peut être passé, et se rejoue depuis Réglages › Apprentissage.

**C'est un jeu** : un roguelite deckbuilder où le deck est fait de cartes Mots. On débloque une carte en la traçant ; avec 10 cartes on lance un *run* (carte à embranchements, nœuds rencontre / élite / repos / boss ; 34 situations couvrant les 2000 mots) ; chaque rencontre est un dialogue dans une situation du quotidien à Taïwan : les répliques arrivent en cartes-mots au rythme de la voix, et l'on remplit leurs trous en glissant des cartes de sa main (5 cartes de même taille alignées en bas, recomplétée à chaque réplique ; un clic met une carte en avant avec ses informations, seul le glisser-déposer la joue). Une case vide montre un « ? » par caractère du mot manquant. Un grand espace au-dessus de l'adversaire est réservé aux futures illustrations. Bonne carte : on avance ; mauvaise : −1 PV. En haut à droite, le portrait de l'interlocuteur (employé de supérette, propriétaire, médecin…) avec le sujet de la discussion, l'avancement, les PV et les répétitions restantes ; dessous, une fenêtre de conversation garde la trace du dialogue : une fois une réplique terminée, ses mots s'envolent des cartes vers une bulle. Après une rencontre, on apprend une nouvelle carte (choix parmi 3). Quatre difficultés : Newcomer (cartes complètes), Seasoned (symboles + pinyin), Resident (symboles seuls), Native (plus de main : le mot manquant s'écrit à la main dans la phrase, trait par trait). La réplique en cours peut être répétée 3 fois par rencontre. Un écran **Entraînement** permet de revoir ses cartes avec toutes leurs informations et de tracer chaque caractère dans une case vide, le modèle animé à côté.

- **Paliers** : les mots sont classés par utilité/fréquence dans 6 paliers cumulés (1-100, 101-200, 201-400, 401-600, 601-1000, 1001-2000) et 14 thèmes (grammaire, pronoms, nombres & temps, verbes, adjectifs, personnes, nourriture, lieux & transport, achats, maison, travail & études, corps & santé, nature, expressions).
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
| 6 | `npm run data:build` | génère `src/data/generated/` : `words.json` (zhuyin dérivé du pinyin) et les données de traits par palier (`hanzi-tN.json`) |

Pour corriger un mot, éditer `data/enriched/part-N.json` ou `data/enriched-en/part-N.json` (ou ajouter une prononciation dans `data/pinyin-overrides.json`) puis relancer les étapes 5 et 6. `data/themes.json` définit les thèmes et leur teinte (OKLCH).

Conventions pinyin : lectures taïwanaises (星期 xīng qí, 法國 fà guó, 垃圾 lè sè…), tons pleins plutôt que neutres, sandhi de 一/不 écrit tel qu'il se prononce (yì diǎn, yí xià, bú cuò). Le zhuyin est dérivé du pinyin. Trois caractères n'ont pas de tracé dans Hanzi Writer (嬤 痠 齁) : ils sont ignorés en mode écriture.

## Mise à l'échelle

L'interface est proportionnelle à la fenêtre : l'unité CSS `--u` vaut 1 px pour une fenêtre de 1400×900 et suit ensuite la plus petite des deux dimensions (bornée). Toutes les tailles (cartes, polices, espacements) sont exprimées en multiples de `--u` ; côté JavaScript, `useUnit()` fournit le même facteur pour la géométrie du carrousel et des canvas.

## Architecture

```
src/core        types, répétition espacée (srs.ts), construction de session, mise à jour de l'état
src/game        jeu : types, génération de carte (map.ts), phrases à trou (lines.ts), situations, état du run (run.ts), tutoriel (tutorial.ts)
src/platform    stockage (Electron/Capacitor/localStorage), synthèse vocale, reconnaissance vocale, enregistreur
src/modes       Intro, Read, Listen, Write, Speak
src/screens     Home (camp), Learn, MapScreen, Battle, RunScreens (récompense/repos/fin), Session (practice), Words (deck), Settings, Tutorial
src/ui          composants (carte colorée, cartes Mots et main en éventail, canvas Hanzi Writer, choix, icônes)
electron/       processus principal (protocole app://, stockage fichier) et preload
android/        projet Android Studio (Capacitor)
ios/            projet Xcode (Capacitor, CocoaPods), compilé sur un Mac
scripts/        pipeline de données, lanceurs Electron/Android, paquet et build iOS (scripts/ios/)
```

## Notes

- **Doublage** : les répliques des scènes sont enregistrées, dans un fichier TT Ogg Opus par personnage et un par voix du joueur (`public/voices/`, construits par `node scripts/build-voices-tt.mjs .cache/dub-wav [--verify]`). Elles sont jouées telles qu'enregistrées, à leur vitesse d'origine (`src/platform/voices.ts`) ; le réglage de vitesse ne concerne que la synthèse vocale.
- **Voix** (doublage) : toutes viennent de locuteurs taïwanais de Mozilla Common Voice zh-TW 27.0 (CC0), une par personnage et deux pour le joueur, clonées avec CosyVoice 3. Les références (extraits non retouchés, silences de bord coupés) et leur phrase sont dans `.cache/commonvoice/voices.json` ; choix par `pick_voices.py`, et `pick_new_voices.py` pour remplacer une voix (candidats à écouter). Pour redoubler une voix : `python dub_gpu.py ../commonvoice/voices.json --voices <voix> [--shard k/N]` dans `.cache/cosyvoice` (carte graphique AMD : environnement `.cache/cosyvoice-rocm-venv`, PyTorch ROCm, `NOMIOPEN=1`), ou `dub_all.py` sur le processeur (`.cache/cosyvoice-venv`). Puis le contrôle `dubcheck.py`, les reprises des prises ratées (`NORMTEXT=1`, `CALM=1`, `--keys <liste>`, `OUT=<dossier>`), le choix `dubpick.py`, et la reconstruction `node scripts/build-voices-tt.mjs .cache/dub-wav --only <fichiers> --verify`.
- **Format des voix (TT File Format 0.3)** : chaque réplique est un segment du fichier, avec son nom (`<scène>-<ligne>-<n|f|m>`) et toutes ses métadonnées (USER, champs de la réplique, ORIGIN). La liste des segments est une table JSON sur une ligne, dans le commentaire `TT_SEGMENT_TABLE` (section 11.5 de la spec) : le nom de chaque élément est écrit une fois, les valeurs communes à toutes les répliques du fichier aussi (`DEFAULTS`). Les répliques sont mises bout à bout sans silence entre elles, sauf ce qui manque à leurs propres bords calmes (60 ms après la voix d'une réplique, 20 ms avant celle de la suivante), avec 100 ms au début et à la fin du fichier. Ainsi chaque fichier pèse moins que les mêmes répliques en fichiers Opus séparés avec les mêmes métadonnées (section 12). Contrôle : `py -I -B <kit>/make_tt_spec_samples.py --validate public/voices/<fichier>.opus` (attendu : `RESULT PASS`, et `lighter` sur la ligne `weight`). Le lecteur `src/platform/tt.ts` lit la table, et encore la liste XML (`TT_SEGMENT_LIST`) des fichiers 0.2 ; il ne décode que les paquets de la réplique demandée.
- **Tutoriel** : sa scène (`src/data/tutorial.json`) n'entre pas dans les runs. Ses deux répliques sont doublées comme les autres et rangées en fin de fichier, dans celui du propriétaire (`landlord.opus`) et dans ceux du joueur. La scène réutilise l'écran de combat sur une rencontre fictive (`src/game/tutorial.ts`, `src/screens/Tutorial.tsx`) : le vrai deck et un run en cours ne sont pas touchés.
- **Voix** : sans doublage, la synthèse vocale prend le relais ; chaque personnage parle avec une voix d'homme ou de femme selon son portrait (Windows : Microsoft Zhiwei pour les hommes, Hanhan/Yating pour les femmes ; Android : voix Google/Samsung reconnues par leur nom, sinon hauteur de voix modifiée ; iOS : voix Apple, dont Mei-Jia pour Taïwan). Choix manuel de la voix des hommes, des femmes et de tes répliques, et vitesse de la synthèse, dans Réglages › Audio.
- **Annotation phonétique** (option, désactivée par défaut) : bopomofo, pinyin, Tongyong ou Wade-Giles à côté de chaque mot (`src/core/phonetics.ts`, contrôle : `node scripts/check-phonetics.mjs`). Le bopomofo s'affiche comme dans les manuels de Taïwan, partout, cartes comprises : en petit, vertical, à droite de chaque caractère et centré sur sa hauteur, ton au coin supérieur droit du dernier symbole (W3C clreq 5.5.3) ; `src/ui/Phonetic.tsx`.
- **Plateaux de jeu** : un par lieu (maquettes Claude Design). En combat, la matière du lieu couvre l'écran (bois, carrelage, sable…), avec une lumière, un grain et une vignette ; un tapis en creux reçoit la main, avec un filet et le sceau rouge du lieu (夜市, 捷運…) ; les panneaux prennent une teinte de la matière. Matières en CSS seul dans `src/boards.css` (`.battle[data-board="<lieu>"]`), sceaux et bords des tapis dans `src/game/boards.ts`.
- **Photos des lieux** : Wikimedia Commons (CC0, domaine public, CC BY, CC BY-SA), une par situation, importées par `node scripts/import-backgrounds.mjs <dossier>` dans `src/assets/bg/` avec `credits.json` ; attributions affichées dans Réglages.
- **Portraits** : illustrations générées avec Google Gemini, 6 par personnage (34 personnages), dans `src/assets/portraits/<situation>-<émotion>.webp` (émotions : neutral, happy, shocked, confused, angry, curious ; import et détourage du fond blanc ou magenta : `node scripts/import-portraits.mjs <dossier>`), affichées par `src/ui/Portrait.tsx`. Galerie de développement : `/?gallery`. En combat, une bonne carte réjouit le personnage ; une mauvaise le laisse un instant perplexe ou choqué, en alternance, avec une bulle « ? » ou « !? » près de la tête (réactions par trait : `TRAIT_REACTIONS`).
- **Polices** : interface en Nunito (SIL OFL, `@fontsource-variable/nunito`) ; caractères chinois avec les polices du système.
- **Reconnaissance vocale** : Android et iOS (plugin natif `@capacitor-community/speech-recognition`). Sur iOS, la phrase n'est rendue qu'à l'arrêt de l'écoute : `src/platform/stt.ts` suit les résultats partiels et s'arrête après 1,2 s de silence (8 s au plus). Sur Windows, la prononciation se travaille par écoute du modèle, enregistrement et auto-évaluation.
- **Données de traits** : [Hanzi Writer](https://hanziwriter.org) (MIT) et *Make Me a Hanzi* (Arphic Public License). Dictionnaire de contrôle : [CC-CEDICT](https://cc-cedict.org) (CC BY-SA 4.0), téléchargé dans `data/external/` (non versionné).

## Android

L'app tourne en **paysage** (les deux sens) dès le lancement, en plein écran immersif (barres d'état et de navigation masquées, un glissement depuis le bord les fait réapparaître un instant), avec une mise en page téléphone : bandeau compact en haut du combat, conversation en volet, carte du run horizontale.

Construire et installer : `npx vite build && npx cap sync android && node scripts/android-build.mjs assembleDebug` produit `android/app/build/outputs/apk/debug/app-debug.apk` (copié dans `release/Richang-0.1.0-android.apk`). Copier l'APK sur le téléphone (câble, Drive, mail) et l'ouvrir ; Android demande d'autoriser l'installation d'applications inconnues pour l'app qui ouvre le fichier. Téléphone branché en USB avec le débogage activé : `adb install -r release/Richang-0.1.0-android.apk`.

## iOS

Même projet web, dans un projet Xcode Capacitor (`ios/App`, CocoaPods, iPhone et iPad, iOS 15 minimum), identifiant `app.richang.mobile` comme sur Android. L'app tourne en **paysage** (plein écran sur iPad, barre d'état masquée) ; les marges de l'encoche et de la barre d'accueil sont prises en compte en CSS (`env(safe-area-inset-*)`). Le son joue même en mode silencieux, sans couper la musique d'une autre app (`AppDelegate.swift`, et `navigator.audioSession` dans `src/platform/voices.ts`). Les sauvegardes exportées vont dans l'app Fichiers (Sur mon iPhone › 日常). Les voix doublées (Ogg Opus) demandent iOS 18.4 ou plus ; avant, la synthèse vocale prend le relais.

Compilation sur un Mac avec Xcode, en ligne de commande, depuis un clone du dépôt :

```bash
git clone https://github.com/Bannl/Richang.git ~/Richang     # ensuite : git -C ~/Richang pull
bash ~/Richang/scripts/ios/build_ios.sh sim       # simulateurs iPhone et iPad, captures dans ~/Richang_shots
bash ~/Richang/scripts/ios/build_ios.sh ipa       # archive + export App Store -> ~/Richang_ipa/App.ipa
bash ~/Richang/scripts/ios/build_ios.sh upload    # idem, puis envoi sur App Store Connect (TestFlight)
bash ~/Richang/scripts/ios/build_ios.sh clean     # libère de la place
```

Le script prépare tout, sans droits administrateur : Node (dans `~/.richang-node` s'il manque), les dépendances npm, CocoaPods (dans `~/.richang-gems`), puis `npm run ios:sync` et `pod install`. L'archive est faite sans signature ; l'export App Store la signe en distribution et crée le profil. L'identifiant d'équipe Apple est demandé une fois et gardé sur le Mac (`~/.richang-ios.env`), jamais dans le dépôt ; l'Apple ID et le mot de passe d'application sont demandés à chaque envoi et jamais écrits. Numéro de build : `AAMMJJ.HHMM` par défaut, ou en deuxième argument.

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

L'App Store, plus tard, demandera :
- la politique de confidentialité, <https://github.com/Bannl/Richang/blob/master/PRIVACY.md> (aussi liée dans les Réglages de l'app) ;
- des captures en paysage : iPhone 6,9" 2868×1320, iPad 13" 2752×2064.

Les réglages natifs (Info.plist, AppDelegate, icônes générées depuis `assets/icon-only.png`, version) vivent dans `ios/` et ne sont pas écrasés par `cap sync`.
