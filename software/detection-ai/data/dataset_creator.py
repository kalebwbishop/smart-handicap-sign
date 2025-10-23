import numpy as np
import torch
import os

from torch.utils.data import Dataset

def create_sine_wave_dataset(length=100, amplitude=1, frequency=1):
    x = np.arange(length)
    sine_wave = amplitude * np.sin(2 * np.pi * frequency * x / length)
    return sine_wave.astype(int)

def create_random_dataset(length=100, low=-1, high=1):
    random_data = np.random.uniform(low, high, length)
    return random_data.astype(int)

def save_dataset(data, labels, path):
    np.savez(path, data=data, labels=labels)

def load_dataset(path):
    loaded = np.load(path)
    return loaded['data'], loaded['labels']

class CustomDataset(Dataset):
    def __init__(self, data, labels):
        self.data = torch.tensor(data, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.long)

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        return self.data[idx], self.labels[idx]

if __name__ == "__main__":
    num_samples = 5000
    sample_length = 256
    amplitude = 10
    frequency = 2
    low = -10
    high = 10

    # Generate 500 sine wave samples with random amplitude, frequency, and offset
    sine_samples = []
    for _ in range(num_samples // 2):
        rand_amplitude = np.random.uniform(5, 15)
        rand_frequency = np.random.uniform(1, 5)
        rand_offset = np.random.uniform(-5, 5)
        x = np.arange(sample_length)
        sine_wave = rand_amplitude * np.sin(2 * np.pi * rand_frequency * x / sample_length + rand_offset)
        sine_samples.append(sine_wave.astype(int))
    # Generate 500 random samples with varied low and high values
    random_samples = []
    for _ in range(num_samples // 2):
        rand_low = int(np.random.uniform(-20, 0))
        rand_high = int(np.random.uniform(0, 20))
        random_array = create_random_dataset(length=sample_length, low=rand_low, high=rand_high)
        random_samples.append(random_array)

    # Stack all samples together
    data = np.array(sine_samples + random_samples)
    labels = np.zeros(num_samples, dtype=int)
    labels[num_samples // 2:] = 1  # First 500 class 0, next 500 class 1

    # Save dataset
    save_path = os.path.join(os.path.dirname(__file__), "sample_dataset.npz")
    save_dataset(data, labels, save_path)
    print(f"Dataset saved to {save_path}")

    # Example: load and use with CustomDataset
    loaded_data, loaded_labels = load_dataset(save_path)
    dataset = CustomDataset(loaded_data, loaded_labels)
    print(f"Loaded dataset: {len(dataset)} samples, shape: {loaded_data.shape}")