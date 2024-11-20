import numpy as np

class Perceptron:
    def __init__(self, input_size, learning_rate=0.01):
        """
        Initialize the perceptron with random weights and a bias term.
        """
        self.weights = np.random.randn(input_size)
        self.bias = np.random.randn()
        self.learning_rate = learning_rate

    def activation(self, x):
        return 1 if x > 0 else 0

    def predict(self, inputs):
        """
        Make a prediction using the perceptron rule.
        """
        linear_output = np.dot(inputs, self.weights) + self.bias
        return self.activation(linear_output)

    def train(self, X, y, epochs=100):
        """
        Train the perceptron using the perceptron learning rule.
        
        X: Input features (2D numpy array)
        y: Target labels (1D numpy array)
        epochs: Number of training iterations
        """
        for epoch in range(epochs):
            for inputs, label in zip(X, y):
                prediction = self.predict(inputs)
                # Update rule: weights and bias
                update = self.learning_rate * (label - prediction)
                self.weights += update * inputs
                self.bias += update

    def evaluate(self, X, y):
        """
        Evaluate the perceptron on a test set.
        
        Returns the accuracy of the model.
        """
        predictions = [self.predict(x) for x in X]
        accuracy = np.mean(predictions == y)
        return accuracy
