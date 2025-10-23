import torch
from torch.utils.data import DataLoader
import torch.nn as nn
import torch.optim as optim

import os
from data.dataset_creator import CustomDataset, load_dataset

print(f"PyTorch version: {torch.__version__}")

# Example model
class SimpleModel(nn.Module):
    def __init__(self, input_dim=256, output_dim=2):
        super(SimpleModel, self).__init__()
        self.relu = nn.ReLU()
        self.conv1 = nn.Conv1d(in_channels=1, out_channels=32, kernel_size=5, stride=1, padding=2)
        self.fc1 = nn.Linear(32, 32)
        self.fc2 = nn.Linear(32, 16)
        self.fc3 = nn.Linear(16, output_dim)

    def forward(self, x):
        # x shape: (batch_size, 256)
        x = x.unsqueeze(1)  # (batch_size, 1, 256)
        x = self.conv1(x)   # (batch_size, 32, 256)
        x = self.relu(x)
        x = x.mean(dim=2)   # Global average pooling over sequence (batch_size, 32)
        x = self.fc1(x)
        x = self.relu(x)
        x = self.fc2(x)
        x = self.relu(x)
        x = self.fc3(x)
        return x

def train(model, dataloader, criterion, optimizer, device, epochs=5):
    model.to(device)
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        for inputs, labels in dataloader:
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()
        print(f"Epoch {epoch+1}/{epochs}, Loss: {running_loss/len(dataloader):.4f}")

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    # Load saved dataset
    dataset_path = os.path.join(os.path.dirname(__file__), "data", "sample_dataset.npz")
    data, labels = load_dataset(dataset_path)
    dataset = CustomDataset(data, labels)
    dataloader = DataLoader(dataset, batch_size=32, shuffle=True)
    print("Input data shape:", data.shape)
    model = SimpleModel(input_dim=data.shape[1], output_dim=2)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    train(model, dataloader, criterion, optimizer, device, epochs=10)

if __name__ == "__main__":
    main()