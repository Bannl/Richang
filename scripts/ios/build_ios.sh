#!/bin/bash
# Richang (日常) : build iOS sur un Mac, en ligne de commande, depuis un clone du depot public.
#   git clone https://github.com/Bannl/Richang.git ~/Richang        (mise a jour ensuite : git -C ~/Richang pull)
#
#   bash ~/Richang/scripts/ios/build_ios.sh sim             compile et lance l'app sur un iPhone et un iPad simules
#   bash ~/Richang/scripts/ios/build_ios.sh ipa    [build]  archive + export App Store -> ~/Richang_ipa/App.ipa
#   bash ~/Richang/scripts/ios/build_ios.sh upload [build]  idem, puis envoi a App Store Connect (TestFlight)
#   bash ~/Richang/scripts/ios/build_ios.sh clean           libere de la place (archive, ipa, DerivedData, simulateurs)
#
# Chaque mode (sauf clean) prepare d'abord le projet, sans droits administrateur : Node (installe dans ~/.richang-node
# s'il manque ou s'il est trop ancien), dependances npm, CocoaPods (installe dans ~/.richang-gems s'il manque), puis
# compilation du jeu et synchronisation du projet Xcode (npm run ios:sync).
# Signature : archive sans signature, puis export App Store qui signe en distribution et cree le profil tout seul.
# L'identifiant d'equipe Apple (TEAM_ID) vient de l'environnement ou de ~/.richang-ios.env (hors du depot) : il est
# demande et enregistre la premiere fois. Envoi : par Xcode, avec le compte Apple connecte dans Xcode (Reglages ›
# Comptes), celui qui signe deja l'export ; aucun mot de passe a saisir. (altool refusait les identifiants : erreur 1235.)
# [build] : numero de build (CFBundleVersion), croissant a chaque envoi ; par defaut AAMMJJ.HHMM.
set -euo pipefail

MODE="${1:-sim}"
BUILD="${2:-$(date +%y%m%d.%H%M)}"
BUNDLE_ID="app.richang.mobile"
NODE_VERSION="24.13.0"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="$ROOT/ios/App"
CONF="$HOME/.richang-ios.env"
ARCHIVE="$HOME/Richang_iOS.xcarchive"
IPA_DIR="$HOME/Richang_ipa"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # CocoaPods exige un terminal UTF-8

say() { printf '\n== %s\n' "$*"; }

case "$MODE" in
  sim|ipa|upload) ;;
  clean)
    say "Menage"
    rm -rf "$ARCHIVE" "$IPA_DIR" "$HOME"/Library/Developer/Xcode/DerivedData/App-*
    xcrun simctl delete unavailable || true
    df -h "$HOME" | tail -1
    exit 0
    ;;
  *) echo "Mode inconnu : $MODE (sim | ipa | upload | clean)"; exit 1 ;;
esac
command -v xcodebuild >/dev/null || { echo "xcodebuild introuvable : Xcode est-il installe ?"; exit 1; }

# --- Questions d'abord : la suite tourne ensuite sans surveillance.
if [ "$MODE" != "sim" ]; then
  if [ -f "$CONF" ]; then . "$CONF"; fi
  if [ -z "${TEAM_ID:-}" ]; then
    read -r -p "Identifiant d'equipe Apple (Team ID, 10 caracteres, developer.apple.com › Membership) : " TEAM_ID
    printf 'TEAM_ID=%s\n' "$TEAM_ID" >> "$CONF"
    echo "Enregistre dans $CONF (hors du depot)."
  fi
  [[ "$TEAM_ID" =~ ^[A-Z0-9]{10}$ ]] || { echo "Team ID invalide : $TEAM_ID (corriger $CONF)"; exit 1; }
fi

# --- Node : celui du Mac s'il est assez recent (Vite demande Node 22), sinon une copie dans ~/.richang-node.
NODE_MAJOR="$(node -v 2>/dev/null | sed -n 's/^v\([0-9]*\).*/\1/p' || true)"
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 22 ]; then
  NODE_DIR="$HOME/.richang-node"
  if [ ! -x "$NODE_DIR/bin/node" ]; then
    case "$(uname -m)" in arm64) ARCH=arm64 ;; *) ARCH=x64 ;; esac
    say "Installation de Node $NODE_VERSION dans $NODE_DIR"
    mkdir -p "$NODE_DIR"
    curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-darwin-$ARCH.tar.gz" | tar -xz -C "$NODE_DIR" --strip-components 1
  fi
  export PATH="$NODE_DIR/bin:$PATH"
fi

# --- CocoaPods : installe d'office au premier lancement dans un dossier perso, avec le Ruby du systeme. Le Ruby de
# macOS (2.6) refuse les dernieres versions de certaines dependances ; gem donne alors la derniere version compatible,
# qu'on installe avant de reessayer.
GEMS="$HOME/.richang-gems"
install_cocoapods() {
  command -v ruby >/dev/null || { echo "Ruby introuvable : impossible d'installer CocoaPods."; return 1; }
  mkdir -p "$GEMS"
  say "Installation de CocoaPods dans $GEMS (une seule fois, quelques minutes ; $(ruby -v | cut -d' ' -f1-2))"
  local i out pin name ver
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    if out="$(gem install cocoapods --no-document 2>&1)"; then printf '%s\n' "$out" | tail -1; return 0; fi
    pin="$(printf '%s\n' "$out" | sed -n 's/.*gem install \([A-Za-z0-9_.-]*\) -v \([0-9][0-9A-Za-z.]*\).*/\1 \2/p' | head -1 || true)"
    if [ -z "$pin" ]; then printf '%s\n' "$out" | tail -25; echo "Echec de l'installation de CocoaPods (voir ci-dessus)."; return 1; fi
    name="${pin% *}"; ver="${pin#* }"
    echo "  $name : derniere version compatible avec ce Ruby, $ver"
    gem install "$name" -v "$ver" --no-document >/dev/null 2>&1 || { echo "Echec : gem install $name -v $ver"; return 1; }
    if [ "$name" = "cocoapods" ]; then return 0; fi
  done
  echo "CocoaPods : trop de dependances a ajuster."
  return 1
}
POD="$(command -v pod || true)"
if [ -z "$POD" ]; then
  export GEM_HOME="$GEMS" PATH="$GEMS/bin:$PATH"
  if [ ! -x "$GEMS/bin/pod" ]; then install_cocoapods || exit 1; fi
  POD="$GEMS/bin/pod"
fi

# --- Dependances npm (reinstallees seulement si package-lock.json a change), jeu compile, projet Xcode et Pods.
cd "$ROOT"
LOCK_SUM="$(shasum package-lock.json | cut -d' ' -f1)"
if [ "$(cat node_modules/.richang-lock 2>/dev/null || true)" != "$LOCK_SUM" ]; then
  say "Dependances npm (Node $(node -v))"
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund
  printf '%s\n' "$LOCK_SUM" > node_modules/.richang-lock
fi
VERSION="$(node -p "require('./package.json').version")"
say "Jeu et projet Xcode (npm run ios:sync)"
npm run ios:sync
cd "$APP_DIR"
"$POD" install
say "$(xcodebuild -version | head -1), CocoaPods $("$POD" --version) : Richang $VERSION (build $BUILD)"
FREE_GB="$(df -g "$HOME" | awk 'NR==2 {print $4}')"
if [ "${FREE_GB:-99}" -lt 5 ]; then echo "Attention : ${FREE_GB} Go libres seulement (bash $0 clean)"; fi

case "$MODE" in
  sim)
    say "Compilation pour le simulateur (sans signature)"
    xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator \
      -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO -quiet build
    PRODUCTS="$(xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -showBuildSettings 2>/dev/null \
      | awk '/Build settings for action build and target App:/ {f=1} f==1 && /^ *BUILT_PRODUCTS_DIR = / {sub(/^ *BUILT_PRODUCTS_DIR = /, ""); print; f=2}')"
    APP="$PRODUCTS/App.app"
    [ -d "$APP" ] || { echo "App.app introuvable dans $PRODUCTS"; exit 1; }
    open -a Simulator || true   # fenetres des appareils simules, visibles par le bureau a distance
    for MODEL in "iPhone [0-9]+ Pro Max" "iPad Pro 13"; do
      LINE="$(xcrun simctl list devices available | grep -E "$MODEL" | tail -1 || true)"
      UDID="$(printf '%s' "$LINE" | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' | head -1 || true)"
      if [ -z "$UDID" ]; then echo "Pas de simulateur « $MODEL » (xcrun simctl list devices available)"; continue; fi
      say "$(printf '%s' "$LINE" | sed -E 's/^ *//; s/ \(.*//') ($UDID)"
      xcrun simctl boot "$UDID" 2>/dev/null || true
      xcrun simctl bootstatus "$UDID" -b >/dev/null
      xcrun simctl install "$UDID" "$APP"
      xcrun simctl launch "$UDID" "$BUNDLE_ID"
    done
    echo "L'app tourne dans l'app Simulator (iPhone et iPad)."
    ;;
  ipa|upload)
    say "Archive Release non signee (version $VERSION, build $BUILD)"
    rm -rf "$ARCHIVE" "$IPA_DIR"
    xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -destination 'generic/platform=iOS' \
      -archivePath "$ARCHIVE" MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD" \
      CODE_SIGNING_ALLOWED=NO -quiet archive
    # Export App Store : en local (ipa), ou envoye directement a App Store Connect (upload) avec le compte Apple
    # connecte dans Xcode. Le numero de build reste celui de l'archive (Xcode ne le change pas).
    if [ "$MODE" = "upload" ]; then DEST=upload; say "Export App Store et envoi a App Store Connect"; else DEST=export; say "Export App Store"; fi
    cat > "$HOME/Richang_exportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store</string>
  <key>destination</key><string>$DEST</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST
    xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$IPA_DIR" \
      -exportOptionsPlist "$HOME/Richang_exportOptions.plist" -allowProvisioningUpdates
    if [ "$MODE" = "upload" ]; then
      echo "Envoye. Le build apparait dans App Store Connect › TestFlight apres traitement (quelques minutes a 1 h)."
    else
      IPA="$(ls "$IPA_DIR"/*.ipa | head -1)"
      echo "IPA : $IPA ($(du -h "$IPA" | cut -f1))"
    fi
    ;;
esac
