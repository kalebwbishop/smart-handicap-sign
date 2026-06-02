import { Audio } from 'expo-av';
import assistanceAlertSoundSource from '../../assets/audio/assistance-alert.wav';

let alertSound: Audio.Sound | null = null;
let alertSoundLoadPromise: Promise<Audio.Sound | null> | null = null;
let alertSoundWanted = false;
let alertSoundPlaying = false;

async function loadAssistanceAlertSound(): Promise<Audio.Sound | null> {
    if (alertSound) {
        return alertSound;
    }

    if (!alertSoundLoadPromise) {
        alertSoundLoadPromise = (async () => {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
            });

            const { sound } = await Audio.Sound.createAsync(
                assistanceAlertSoundSource,
                {
                    isLooping: true,
                    shouldPlay: true,
                },
            );

            alertSound = sound;
            alertSoundPlaying = true;

            if (!alertSoundWanted) {
                alertSound = null;
                alertSoundPlaying = false;
                await sound.unloadAsync();
                return null;
            }

            return sound;
        })().finally(() => {
            alertSoundLoadPromise = null;
        });
    }

    return alertSoundLoadPromise;
}

export async function startAssistanceAlertSound(): Promise<void> {
    alertSoundWanted = true;

    if (alertSoundPlaying) {
        return;
    }

    await loadAssistanceAlertSound();
}

export async function stopAssistanceAlertSound(): Promise<void> {
    alertSoundWanted = false;

    const sound = alertSound;
    if (!sound) {
        return;
    }

    alertSound = null;
    alertSoundPlaying = false;
    await sound.unloadAsync();
}
