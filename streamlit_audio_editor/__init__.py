import os
import streamlit.components.v1 as components

_RELEASE = True

if _RELEASE:
    _component_func = components.declare_component(
        "streamlit_audio_editor",
        path=os.path.join(os.path.dirname(__file__), "frontend/build"),
    )
else:
    _component_func = components.declare_component(
        "streamlit_audio_editor",
        url="http://localhost:3001",
    )


def st_audio_editor(audio_url=None, key=None):
    """
    Render an interactive browser-based audio editor with a full effects rack
    and jam-session recording.

    Supports loading any audio format the browser can decode (MP3, WAV, OGG,
    M4A, FLAC). Users can trim, adjust gain, apply real-time effects (EQ,
    filter, compressor, delay, chorus, distortion, tremolo, reverb, pan,
    speed/pitch), route a microphone through the chain, and record the
    effected output — all client-side via the Web Audio API.

    Parameters
    ----------
    audio_url : str, optional
        URL or data-URI of an audio file to pre-load.
    key : str, optional
        Streamlit widget key.

    Returns
    -------
    dict | None
        On **Export Trim**, returns a dict with ``type="export"``::

            {
                "type":       "export",
                "trimStart":  float,
                "trimEnd":    float,
                "duration":   float,
                "gain":       float,
                "wavBase64":  str,    # base64-encoded WAV
                # … plus all current effect parameters
            }

        On **Send Recording** (jam session), returns ``type="recording"``::

            {
                "type":             "recording",
                "mimeType":         str,   # e.g. "audio/webm;codecs=opus"
                "recordingBase64":  str,   # base64-encoded audio blob
                "durationSec":      float,
            }

        Returns None until the user exports or sends a recording.

    Example
    -------
    >>> import base64, streamlit as st
    >>> from streamlit_audio_editor import st_audio_editor
    >>>
    >>> result = st_audio_editor(key="editor")
    >>> if result and result.get("type") == "export":
    ...     wav = base64.b64decode(result["wavBase64"])
    ...     st.audio(wav, format="audio/wav")
    >>> if result and result.get("type") == "recording":
    ...     st.audio(base64.b64decode(result["recordingBase64"]),
    ...              format=result["mimeType"])
    """
    return _component_func(audio_url=audio_url, key=key, default=None)
