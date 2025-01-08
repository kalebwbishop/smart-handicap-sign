import numpy as np
from tensorflow.keras.models import load_model

class Classify:
    def __init__(self):
        self.model = load_model('hazard_light_classifier.h5')

    def classify(self, input_intensities: np.ndarray) -> bool:
        input_intensities = input_intensities.reshape(1, input_intensities.shape[0], 1)
        prediction = self.model.predict(input_intensities)[0][0]
        return prediction > 0.5
