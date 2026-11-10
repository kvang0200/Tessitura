# Tessitura

A vocal pitch trainer that runs entirely in the browser. Sing into your mic and it shows, note by note, whether you're on pitch, for built-in exercises or for songs you upload.

**Open it:** https://kvang0200.github.io/Tessitura/ (on iPad: Share → Add to Home Screen).
Works on phones, tablets (portrait or landscape) and computers. On a computer you can also open `index.html` straight from the folder. Nothing is uploaded anywhere: songs, takes and progress stay in the browser on your device.

## What it does

- **Practice:** a scrolling piano roll of the target notes with your live pitch on top, scored with Easy / Standard / Strict tolerance, an A–B loop, zoom and key changes.
- **Your own songs:** add a full mix, an isolated vocals file, an instrumental, or vocals + instrumental. The app finds the sung notes and plays the music for you to sing along to.
- **Lyrics:** paste plain lyrics and place them automatically, tap along to sync them, or load a timed `.lrc` file.
- **Takes:** record each run and listen back over the music.
- **Train:** a vocal range finder (which also picks a key that fits you), ear-training drills and a daily routine with a streak.
- **Progress:** session history plus a weak-spots report that builds a drill from the notes and leaps you miss most.

## Project layout

Plain HTML, CSS and JavaScript with no build step and no dependencies. The scripts are ordinary `<script>` tags loaded in order, so the app works both from GitHub Pages and from a local file.

| File | Role |
| --- | --- |
| `index.html` | Page markup; loads the stylesheet and scripts |
| `css/app.css` | All styling |
| `css/fonts.css`, `fonts/` | Self-hosted fonts (no requests to Google or any other server) |
| `icons/` | Browser and Home Screen icons |
| `js/core.js` | Shared helpers, settings, built-in song library, storage (IndexedDB), FFT |
| `js/analysis.js` | Song analysis: vocal isolation, pitch tracking, note building |
| `js/tracks.js` | Adding songs (upload window, vocals/instrumental slots), saving and deleting tracks |
| `js/audio.js` | Audio context, microphone, live pitch detection (YIN), tones |
| `js/practice.js` | The Practice screen: piano roll, playback, loop, zoom, note editing |
| `js/results.js` | Scoring a run, the results window, help and custom-song dialogs |
| `js/tuner.js` | Free-sing tuner |
| `js/progress.js` | Progress tab: history and charts |
| `js/range.js` | Vocal range finder and the Train tab |
| `js/takes.js` | Recording and playing back takes |
| `js/lyrics.js` | Lyrics: built-in, editor, tap-sync, automatic placement |
| `js/ear.js` | Ear-training drills |
| `js/weak.js` | Weak-spots report and drill builder |
| `js/routine.js` | Daily routine and streak |
| `js/touch.js` | Phones and tablets: song drawer, settings sheet, tap-to-explain tips, pinch and drag on the lanes |
| `js/main.js` | Start-up, tab switching, keyboard shortcuts, drag-and-drop |

Script order matters: `core.js` comes first and `main.js` last.

## Security

- **Content Security Policy** (in `index.html`): only the app's own scripts, styles and fonts can load; no inline scripts, no third-party hosts, no plugins, no forms, no `<base>` changes. Keep it that way: don't add inline `<script>` blocks or `on…=` attributes, and bundle any new library instead of linking a CDN.
- **No outside requests:** fonts are self-hosted and the referrer is never sent, so nothing about you or your songs leaves the device.
- **Saved data is validated** when read back (`store` and `cleanTrackMeta` in `core.js`, `takesFor` in `takes.js`). On GitHub Pages every project under the same account shares one origin, and so one localStorage/IndexedDB, so stored values are treated as untrusted: wrong types are dropped, numbers are clamped and text is escaped before it reaches the page.
- **User text is escaped** (`esc()` or `textContent`) everywhere it is shown: song titles, file names, lyrics, melody names.
- **Uploads** are decoded locally and capped at 300 MB per audio file, 500 KB per lyrics file.
