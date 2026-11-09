#!/bin/bash
# Downloads the recorded instrument samples and prepares them for src/samples/<instrument>/<midi>.mp3:
# mono, leading silence trimmed (so notes start on time), cut to a few seconds with a fade, and each note's
# loudness evened out (about -20 dB average over its first second, peaks no higher than -1 dB).
# Sources and licences are in src/samples/CREDITS.md. Needs curl and ffmpeg. Rerun to rebuild them all.
#   tools/make_samples.bash [instrument...]
set -euo pipefail
HERE=$(cd "$(dirname "$0")/.." && pwd)
OUT=$HERE/src/samples
RAW=${RAW:-$(mktemp -d)}

SAL=https://tonejs.github.io/audio/salamander             # Salamander Grand Piano
TJ=https://nbrosowsky.github.io/tonejs-instruments/samples  # tonejs-instruments
MAN=https://raw.githubusercontent.com/sfzinstruments/Terkelsen.Mandolin/master/samples  # Terkelsen's Mandolin
FL=https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM   # FluidR3 GM

# instrument | seconds kept | url prefix | "midi:file" for each note (sounding pitches; file without extension = .mp3).
# The mandolin's files are named an octave low ("01g2" is really G3, its open G string): the loud layer, " 1".
SETS=(
  "piano|4|$SAL|57:A3 60:C4 63:Ds4 66:Fs4 69:A4 72:C5 75:Ds5 78:Fs5 81:A5 84:C6"
  "guitar|4|$TJ/guitar-acoustic|40:E2 43:G2 46:As2 49:Cs3 52:E3 55:G3 58:As3 61:Cs4 64:E4 67:G4"
  "bass|3|$FL/acoustic_bass-mp3|40:E2 43:G2 46:Bb2 49:Db3 52:E3 55:G3 58:Bb3 61:Db4"
  "flute|5|$TJ/flute|60:C4 64:E4 69:A4 72:C5 76:E5 81:A5 84:C6"
  "organ|5|$TJ/organ|57:A3 60:C4 63:Ds4 66:Fs4 69:A4 72:C5 75:Ds5 78:Fs5 81:A5 84:C6"
  "violin|5|$TJ/violin|55:G3 60:C4 64:E4 67:G4 72:C5 76:E5 79:G5 84:C6"
  "mandolin|3|$MAN|55:01g2%201.wav 58:04a+2%201.wav 61:07c+3%201.wav 64:10e3%201.wav 67:13g3%201.wav 70:16a+3%201.wav 73:19c+4%201.wav 76:22e4%201.wav 79:25g4%201.wav 82:28a+4%201.wav"
  "cello|5|$TJ/cello|36:C2 39:Ds2 43:G2 46:As2 49:Cs3 52:E3 55:G3 58:As3 61:Cs4 64:E4"
  "banjo|3|$FL/banjo-mp3|50:D3 53:F3 56:Ab3 59:B3 62:D4 65:F4 68:Ab4 71:B4"
  "bell|3|$FL/tubular_bells-mp3|57:A3 60:C4 63:Eb4 66:Gb4 69:A4 72:C5 75:Eb5 78:Gb5 81:A5 84:C6"
)

want=" $* "
for set in "${SETS[@]}"; do
  IFS='|' read -r id secs url notes <<<"$set"
  [ $# -gt 0 ] && [[ "$want" != *" $id "* ]] && continue
  cache=$RAW/$(basename "$url")    # keyed by source, so switching an instrument's source never reuses old files
  mkdir -p "$cache" "$OUT/$id"
  rm -f "$OUT/$id"/*.mp3
  for pair in $notes; do
    midi=${pair%%:*}; name=${pair#*:}
    [[ "$name" == *.* ]] || name=$name.mp3
    src=$cache/${name//%20/_}
    [ -s "$src" ] || curl -sfL -o "$src" "$url/$name"
    trim="silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:$secs,afade=t=out:st=$(echo "$secs - 0.6" | bc):d=0.6"
    # measure the trimmed note: average over its first second, and its peak
    mean=$(ffmpeg -nostats -i "$src" -af "pan=mono|c0=0.5*c0+0.5*c1,$trim,atrim=0:1,volumedetect" -f null - 2>&1 | sed -n 's/.*mean_volume: \(-*[0-9.]*\) dB/\1/p')
    peak=$(ffmpeg -nostats -i "$src" -af "pan=mono|c0=0.5*c0+0.5*c1,$trim,volumedetect" -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB/\1/p')
    gain=$(echo "g = -20 - ($mean); p = -1 - ($peak); if (g > p) g = p; g" | bc -l)
    ffmpeg -v error -y -i "$src" -af "pan=mono|c0=0.5*c0+0.5*c1,$trim,volume=${gain}dB" -ar 44100 -ac 1 -b:a 80k "$OUT/$id/$midi.mp3"
    printf '%-7s %3s %-4s mean %6s peak %6s gain %+.1f dB\n' "$id" "$midi" "${name%.*}" "$mean" "$peak" "$gain"
  done
done
du -sh "$OUT"/*/ | sed 's|'"$OUT"'/||'
