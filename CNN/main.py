import numpy as np
from tensorflow.keras import layers, models
from sklearn.model_selection import train_test_split

def generate_data(samples=1000, label=1) -> tuple[np.ndarray, np.ndarray]:
    time_steps = 128
    time = np.linspace(0, 3, time_steps)

    freq = np.linspace(0.75, 4, samples)
    data = np.ndarray(shape=(samples, time_steps), dtype=float)

    for i in range(samples):
        if label == 1:
            pulse_wave = np.sin(2 * np.pi * freq[i] * time)
        else:
            pulse_wave = np.random.uniform(-1, 1, time_steps)  # Random noise

        light_intensity = np.clip(pulse_wave, 0, 1) * 100
        noise = np.random.normal(0, 5, time_steps)
        light_intensity += noise
        light_intensity = np.clip(light_intensity, 0, 100)

        data[i] = light_intensity

    labels = np.full(samples, label)
    return data, labels


def build_model(input_shape: tuple) -> models.Sequential:
    model = models.Sequential()
    model.add(layers.Conv1D(32, kernel_size=3, activation='relu', input_shape=input_shape))
    model.add(layers.MaxPooling1D(pool_size=2))
    model.add(layers.Conv1D(64, kernel_size=3, activation='relu'))
    model.add(layers.MaxPooling1D(pool_size=2))
    model.add(layers.Flatten())
    model.add(layers.Dense(128, activation='relu'))
    model.add(layers.Dropout(0.5))
    model.add(layers.Dense(1, activation='sigmoid'))  # Binary classification

    return model


def main():
    # Generate positive and negative samples
    pos_data, pos_labels = generate_data(samples=800, label=1)
    neg_data, neg_labels = generate_data(samples=800, label=0)

    # Combine and shuffle
    data = np.concatenate([pos_data, neg_data], axis=0)
    labels = np.concatenate([pos_labels, neg_labels], axis=0)

    # Train-test split
    train_data, test_data, train_labels, test_labels = train_test_split(
        data, labels, test_size=0.2, random_state=42
    )

    # Reshape for Conv1D input
    train_data = train_data.reshape(train_data.shape[0], train_data.shape[1], 1)
    test_data = test_data.reshape(test_data.shape[0], test_data.shape[1], 1)

    # Build the model
    model = build_model(input_shape=(train_data.shape[1], 1))

    # Compile with binary cross-entropy
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

    # Train the model
    model.fit(train_data, train_labels, epochs=50, batch_size=32, validation_split=0.1)

    # Evaluate the model
    loss, accuracy = model.evaluate(test_data, test_labels)
    print(f"Test Accuracy: {accuracy * 100:.2f}%")

    # Save the model
    model.save('hazard_light_classifier.h5')


if __name__ == "__main__":
    main()
