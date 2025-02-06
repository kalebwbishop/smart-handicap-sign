import json
import numpy as np

with open('raw_positive.json', 'r') as f:
    brightness_values = json.load(f)

brightness_values = np.array(brightness_values)

positive_training_data = np.array([brightness_values[i:i+500]  for i in range(0, len(brightness_values) - 500)])
max_values = np.max(positive_training_data, axis=1)
min_values = np.min(positive_training_data, axis=1)

positive_training_data = np.hstack((positive_training_data, max_values[:, None], min_values[:, None]))



print(positive_training_data.shape)

with open('raw_negative.json', 'r') as f:
    brightness_values = json.load(f)

brightness_values = np.array(brightness_values)

negative_training_data = np.array([brightness_values[i:i+500]  for i in range(0, len(brightness_values) - 500)])
max_values = np.max(negative_training_data, axis=1)
min_values = np.min(negative_training_data, axis=1)

negative_training_data = np.hstack((negative_training_data, max_values[:, None], min_values[:, None]))

print(negative_training_data.shape)

training_data = np.vstack((positive_training_data, negative_training_data))
print(training_data.shape)

labels = np.array([1] * positive_training_data.shape[0] + [0] * negative_training_data.shape[0])
print(labels.shape)

with open('training_data.json', 'w') as f:
    json.dump(training_data.tolist(), f, indent=4)

