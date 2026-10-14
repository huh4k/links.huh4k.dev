#!/usr/bin/env bash
# Exports CS2 knife models from your game files as .glb into public/models/knives/.
# The site loads /models/knives/<knife_folder>.glb by knife name (see getKnifeModelPath in
# src/utils/weaponModels.ts) and orients each model into a side profile automatically.
#
# Usage (macOS), from the repo root:
#   VPK=~/CS2_PakFiles/game/csgo/pak01_dir.vpk CLI=~/path/to/Source2Viewer-CLI scripts/export-knife-models.sh
# Export only some knives:  KNIVES="karambit m9 butterfly" ...
set -euo pipefail
: "${VPK:=$HOME/CS2_PakFiles/game/csgo/pak01_dir.vpk}"; : "${CLI:=./Source2Viewer-CLI}"
: "${OUT:=$HOME/cs2_knives_export}"; : "${DEST:=public/models/knives}"
: "${KNIVES:=bayonet bowie butterfly canis cord css default_ct default_t falchion flip gut karambit kukri m9 navaja outdoor push skeleton stiletto tactical talon ursus}"

mkdir -p "$OUT" "$DEST"
for k in $KNIVES; do
  model="weapons/models/knife/knife_${k}/weapon_knife_${k}.vmdl_c"
  echo "== knife_${k}"
  "$CLI" -i "$VPK" -o "$OUT" -d --gltf_export_format glb --gltf_export_materials --gltf_textures_adapt -f "$model" || { echo "  export failed" >&2; continue; }
  glb="$(find "$OUT" -name "weapon_knife_${k}*.glb" -print -quit)"
  if [ -n "$glb" ]; then
    cp "$glb" "$DEST/knife_${k}.glb"
    echo "  -> $DEST/knife_${k}.glb ($(du -h "$DEST/knife_${k}.glb" | cut -f1))"
  else
    echo "  no .glb produced; check $OUT" >&2
  fi
done
