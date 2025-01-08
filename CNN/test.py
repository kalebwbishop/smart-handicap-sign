import numpy as np
from tensorflow.keras.models import load_model
import matplotlib.pyplot as plt


def generate_test_wave(frequency=2, time_steps=128) -> np.ndarray:
    time = np.linspace(0, 3, time_steps)
    pulse_wave = np.sin(2 * np.pi * frequency * time)
    light_intensity = np.clip(pulse_wave, 0, 1) * 100
    noise = np.random.normal(0, 5, time_steps)
    light_intensity += noise
    light_intensity = np.clip(light_intensity, 0, 100)
    return light_intensity


def classify_wave(wave: np.ndarray, model_path='hazard_light_classifier.h5') -> str:
    model = load_model(model_path)
    wave = wave.reshape(1, wave.shape[0], 1)
    prediction = model.predict(wave)[0][0]
    return 'Fits Category' if prediction > 0.5 else 'Does Not Fit Category'


if __name__ == "__main__":
    # Generate and classify a test wave
    test_wave = generate_test_wave(frequency=3)
    result = classify_wave(test_wave)
    print(f"Classification Result: {result}")

    # Plot the test wave
    plt.figure(figsize=(10, 5))
    plt.plot(test_wave, label='Test Wave')
    plt.xlabel('Time Steps')
    plt.ylabel('Light Intensity')
    plt.title('Generated Test Wave')
    plt.legend()
    plt.grid(True)
    plt.show()
