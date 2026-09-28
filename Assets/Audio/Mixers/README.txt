========================================================================
ASCENDRA — AUDIO MIXER CONFIGURATION GUIDE
========================================================================

To route background music through Unity AudioMixer:

1. In Unity Editor, right-click in Assets/Audio/Mixers/ -> Create -> Audio Mixer.
2. Name it: ASCENDRAAudioMixer
3. Double-click ASCENDRAAudioMixer to open the Audio Mixer Window.
4. Under "Groups", add child groups under Master:
     Master
      ├── Music
      ├── SFX
      └── UI
5. Select the [BackgroundMusicManager] GameObject (or prefab) in Inspector.
6. Drag the "Music" group from your Audio Mixer into the "Audio Mixer Group" field on BackgroundMusicManager.

Note:
The BackgroundMusicManager works fully out-of-the-box using direct AudioSource volume control even if no AudioMixer is assigned. Routing to an AudioMixer is optional but supported for advanced audio balancing.
