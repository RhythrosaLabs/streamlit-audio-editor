# Changelog

## 0.4.0

### Effects rack
- 3-Band EQ (low shelf 320 Hz, mid peak 1 kHz, high shelf 3.2 kHz, ±12 dB each)
- Filter (lowpass / highpass / bandpass / notch) with frequency + resonance (Q)
- Compressor (threshold, ratio, attack, release)
- Chorus (LFO-modulated delay with rate, depth, mix)
- Tremolo (LFO amplitude modulation with rate and depth)
- Stereo Pan (L–C–R)
- Speed / Pitch control (0.25× – 3×, tape-style playback rate)

### Jam Session recording
- Microphone input — route live mic audio through the entire effects chain
- Record button captures the fully-effected output via MediaRecorder
- Timer, preview, download, and "Send to Streamlit" for recordings
- Return value now includes `type` field (`"export"` or `"recording"`)

### Misc
- Persistent effects chain built once; all parameters update live via AudioParam
- Collapsible effects rack UI
- Recording indicator overlay on waveform canvas

## 0.3.0

- Real-time effects: delay (time + feedback), reverb (convolution), distortion (waveshaper)
- Persistent always-connected effects chain — no playback restart when tweaking
- Individual useEffects for direct AudioParam updates
- Add screenshot to README

## 0.2.0

- Wire up Streamlit bidirectional communication (setComponentReady, RENDER_EVENT, setComponentValue)
- Auto-load audio from `audio_url` arg passed from Python
- Return trimmed WAV as base64 to Python on export
- Fix: `gain` variable shadow in `startPlayback` — gain slider now actually works
- Add `Framework :: Streamlit` classifier to setup.py
- Add project_urls (Bug Tracker, Changelog) to setup.py
- Fix .gitignore: stop ignoring frontend build dir (required for PyPI)

## 0.1.1

- Set author to Dan Sheils

## 0.1.0

- Initial release

