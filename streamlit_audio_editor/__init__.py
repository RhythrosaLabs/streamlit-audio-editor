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
    Render an interactive browser-based audio editor.

    Supports loading any audio format the browser can decode (MP3, WAV, OGG,
    M4A, FLAC). Users can trim, adjust gain, loop, and export a clean WAV of
    the selected region — all in-browser with no server-side ffmpeg required.

    Parameters
    ----------
    audio_url : str, optional
        URL or data-URI of an audio file to pre-load. If None, the user loads
        a file via the in-editor button.
    key : str, optional
        Streamlit widget key.

    Returns
    -------
    dict | None
        On export, returns::

            {
                "trimStart": float,   # seconds
                "trimEnd":   float,   # seconds
                "duration":  float,   # total file duration in seconds
                "gain":      float,   # 0.0–2.0
                "wavBase64": str,     # base64-encoded WAV of trimmed region
            }

        Returns None until the user clicks Export.

    Example
    -------
    >>> import base64, streamlit as st
    >>> from streamlit_audio_editor import st_audio_editor
    >>>
    >>> result = st_audio_editor(key="editor")
    >>> if result:
    ...     wav_bytes = base64.b64decode(result["wavBase64"])
    ...     st.audio(wav_bytes, format="audio/wav")
    ...     st.download_button("Download", wav_bytes, "trimmed.wav")
    """
    return _component_func(audio_url=audio_url, key=key, default=None)
