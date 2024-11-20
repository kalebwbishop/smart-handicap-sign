import numpy as np

def normalize_wave(wave):
    return (wave - np.min(wave)) / (np.max(wave) - np.min(wave))

def sine_wave(frequency, duration, sample_rate=150):
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = np.sin(2 * np.pi * frequency * t)
    return normalize_wave(wave)

def square_wave(frequency, duration, sample_rate=150):
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = np.sign(np.sin(2 * np.pi * frequency * t))  # -1 to 1, so normalize it
    return normalize_wave(wave)

def sawtooth_wave(frequency, duration, sample_rate=150):
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = 2 * (t * frequency - np.floor(t * frequency + 0.5))  # Sawtooth pattern
    return normalize_wave(wave)

def triangular_wave(frequency, duration, sample_rate=150):
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = 2 * np.abs(2 * (t * frequency - np.floor(t * frequency + 0.5))) - 1  # Triangular pattern
    return normalize_wave(wave)

def pulse_wave(frequency, duration, duty_cycle=0.5, sample_rate=150):
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = (np.mod(t * frequency, 1) < duty_cycle).astype(float)  # On for duty_cycle, off otherwise
    return wave  # Pulse wave is already between 0 and 1

def ramp_wave(frequency, duration, sample_rate=150):
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = (t * frequency) % 1  # Linear ramp that repeats every cycle
    return wave  # Already between 0 and 1

def exponential_wave(frequency, duration, sample_rate=150):
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = np.exp(-frequency * t)  # Exponential decay
    return normalize_wave(wave)