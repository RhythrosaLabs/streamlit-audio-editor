# Changelog

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

