# Normalizer function
def normalize_input_data(input_data):
    min_value = min(input_data)
    max_value = max(input_data)

    if min_value == max_value:
        return [0.5] * len(input_data)

    return [(float(x) - min_value) / (max_value - min_value) for x in input_data]

def classify(input_data, size, perceptron):    
    # Ensure the input is an array of 256 numbers
    if len(input_data) != size:
        raise ValueError("Input data must be an array of {} numbers".format(size))
    
    # Step 1: Normalize Input Data
    normalized_input_data = normalize_input_data(input_data)

    print(len(normalized_input_data))

    prediction = perceptron.predict(normalized_input_data)

    print("Prediction: ", prediction)

    return prediction

