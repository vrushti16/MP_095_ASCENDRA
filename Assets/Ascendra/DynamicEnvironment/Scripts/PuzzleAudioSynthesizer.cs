using System;
using UnityEngine;

namespace Ascendra.DynamicEnvironment
{
    /// <summary>
    /// Procedurally synthesizes and plays rich in-world puzzle audio effects.
    /// Eliminates any dependency on external WAV/MP3 files.
    /// </summary>
    public class PuzzleAudioSynthesizer : MonoBehaviour
    {
        public static PuzzleAudioSynthesizer Instance { get; private set; }

        private AudioSource audioSource;
        private AudioClip stoneGrindClip;
        private AudioClip mechanicalClickClip;
        private AudioClip subtleErrorClip;
        private AudioClip victoryFanfareClip;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            audioSource = GetComponent<AudioSource>();
            if (audioSource == null)
            {
                audioSource = gameObject.AddComponent<AudioSource>();
            }

            audioSource.playOnAwake = false;
            audioSource.spatialBlend = 0f; // Clean 2D stereo presentation for puzzle encounter
            audioSource.volume = 0.85f;

            GenerateClips();
        }

        private void GenerateClips()
        {
            stoneGrindClip = CreateStoneGrindClip();
            mechanicalClickClip = CreateMechanicalClickClip();
            subtleErrorClip = CreateSubtleErrorClip();
            victoryFanfareClip = CreateVictoryFanfareClip();
        }

        /// <summary>
        /// Plays stone-on-stone friction grinding sound when rotating a dial or monument.
        /// </summary>
        public void PlayStoneRotate()
        {
            if (stoneGrindClip != null && audioSource != null)
            {
                audioSource.PlayOneShot(stoneGrindClip, 0.7f);
            }
        }

        /// <summary>
        /// Plays sharp mechanical latch click when a stone locks or steps into place.
        /// </summary>
        public void PlayMechanicalClick()
        {
            if (mechanicalClickClip != null && audioSource != null)
            {
                audioSource.PlayOneShot(mechanicalClickClip, 0.85f);
            }
        }

        /// <summary>
        /// Plays subtle, low in-world resonance when an action is misaligned or incomplete.
        /// No loud buzzer, no quiz sounds.
        /// </summary>
        public void PlaySubtleError()
        {
            if (subtleErrorClip != null && audioSource != null)
            {
                audioSource.PlayOneShot(subtleErrorClip, 0.5f);
            }
        }

        /// <summary>
        /// Plays radiant victory chime chord when the puzzle mechanism is solved.
        /// </summary>
        public void PlayVictoryFanfare()
        {
            if (victoryFanfareClip != null && audioSource != null)
            {
                audioSource.PlayOneShot(victoryFanfareClip, 0.95f);
            }
        }

        // ==========================================
        // Procedural Audio Generators
        // ==========================================

        private AudioClip CreateStoneGrindClip()
        {
            int sampleRate = 44100;
            float duration = 0.28f;
            int totalSamples = Mathf.RoundToInt(sampleRate * duration);
            float[] data = new float[totalSamples];

            System.Random rand = new System.Random(42);
            float lowPass = 0f;

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / totalSamples;
                float noise = (float)(rand.NextDouble() * 2.0 - 1.0);

                // Low-pass filter for heavy stone rumble
                lowPass += (noise - lowPass) * 0.12f;

                // Subtle low rumble oscillation ~90Hz
                float rumble = Mathf.Sin(2f * Mathf.PI * 90f * ((float)i / sampleRate));

                // Envelope: swell in, taper off
                float env = Mathf.Sin(t * Mathf.PI);

                data[i] = (lowPass * 0.65f + rumble * 0.35f) * env;
            }

            AudioClip clip = AudioClip.Create("Proc_StoneGrind", totalSamples, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        private AudioClip CreateMechanicalClickClip()
        {
            int sampleRate = 44100;
            float duration = 0.12f;
            int totalSamples = Mathf.RoundToInt(sampleRate * duration);
            float[] data = new float[totalSamples];

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / totalSamples;
                float timeSec = (float)i / sampleRate;

                // Crisp transient high click + body thump
                float transient = Mathf.Sin(2f * Mathf.PI * 1800f * timeSec) * Mathf.Exp(-t * 28f);
                float thump = Mathf.Sin(2f * Mathf.PI * 160f * timeSec) * Mathf.Exp(-t * 14f);

                data[i] = (transient * 0.5f + thump * 0.5f) * (1f - t);
            }

            AudioClip clip = AudioClip.Create("Proc_MechanicalClick", totalSamples, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        private AudioClip CreateSubtleErrorClip()
        {
            int sampleRate = 44100;
            float duration = 0.35f;
            int totalSamples = Mathf.RoundToInt(sampleRate * duration);
            float[] data = new float[totalSamples];

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / totalSamples;
                float timeSec = (float)i / sampleRate;

                // Soft dissonant minor second hum (130Hz and 138Hz)
                float hum1 = Mathf.Sin(2f * Mathf.PI * 130f * timeSec);
                float hum2 = Mathf.Sin(2f * Mathf.PI * 138f * timeSec);
                float env = Mathf.Sin(t * Mathf.PI);

                data[i] = ((hum1 + hum2) * 0.5f) * env * 0.4f;
            }

            AudioClip clip = AudioClip.Create("Proc_SubtleError", totalSamples, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        private AudioClip CreateVictoryFanfareClip()
        {
            int sampleRate = 44100;
            float duration = 1.8f;
            int totalSamples = Mathf.RoundToInt(sampleRate * duration);
            float[] data = new float[totalSamples];

            // Harmonic chord: C4 (261.63Hz), E4 (329.63Hz), G4 (392.00Hz), C5 (523.25Hz), E5 (659.25Hz)
            float[] freqs = new float[] { 261.63f, 329.63f, 392.00f, 523.25f, 659.25f };
            float[] delays = new float[] { 0.0f, 0.12f, 0.24f, 0.36f, 0.48f }; // gentle harp arpeggio

            for (int i = 0; i < totalSamples; i++)
            {
                float timeSec = (float)i / sampleRate;
                float sampleAcc = 0f;

                for (int note = 0; note < freqs.Length; note++)
                {
                    float noteTime = timeSec - delays[note];
                    if (noteTime >= 0f)
                    {
                        float env = Mathf.Exp(-noteTime * 1.8f);
                        float tone = Mathf.Sin(2f * Mathf.PI * freqs[note] * noteTime) +
                                     0.4f * Mathf.Sin(2f * Mathf.PI * freqs[note] * 2f * noteTime);
                        sampleAcc += tone * env;
                    }
                }

                data[i] = sampleAcc * 0.18f;
            }

            AudioClip clip = AudioClip.Create("Proc_VictoryFanfare", totalSamples, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
