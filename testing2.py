import numpy as np

def manual_convolve(x, h):
    """
    Manually apply convolution between input signal x and filter h (kernel).
    Args:
        x (ndarray): The input signal
        h (ndarray): The filter/kernel
    Returns:
        y (ndarray): The convolved output
    """
    N = len(x)
    M = len(h)
    y = np.zeros(N + M - 1)  # The length of the output is N + M - 1

    # Apply convolution (manual summing of products)
    for i in range(N + M - 1):
        for j in range(M):
            if i - j >= 0 and i - j < N:
                y[i] += x[i - j] * h[j]
    
    return y

def apply_filter_manual(b, a, x):
    """
    Apply the manual convolution filter to signal x with coefficients b (numerator) and a (denominator).
    Args:
        b (ndarray): Numerator (filter) coefficients.
        a (ndarray): Denominator coefficients (we use a[0] for this simplified example).
        x (ndarray): The signal to be filtered.
    Returns:
        y (ndarray): The filtered signal.
    """
    # Use manual convolution
    y = manual_convolve(x, b) / a[0]  # Simplified version with division by a[0]
    return y

def manual_filtfilt(b, a, x):
    """
    Manually apply forward and reverse filtering using manual convolution.
    Args:
        b (ndarray): Numerator (filter) coefficients.
        a (ndarray): Denominator coefficients.
        x (ndarray): The signal to be filtered.
    Returns:
        y_final (ndarray): The filtered signal with zero phase distortion.
    """
    # Step 1: Forward filtering
    y_fwd = apply_filter_manual(b, a, x)
    
    # Step 2: Reverse the filtered signal
    y_rev = y_fwd[::-1]
    
    # Step 3: Apply the filter again to the reversed signal (forward direction)
    y_rev_filtered = apply_filter_manual(b, a, y_rev)
    
    # Step 4: Reverse it back to the original direction
    y_final = y_rev_filtered[::-1]
    
    return y_final

# Example usage:
if __name__ == "__main__":
    # Create a sample signal
    t = np.linspace(0, 1.0, 100)
    x = np.sin(2 * np.pi * 5 * t) + 0.5 * np.random.randn(100)

    # Example filter coefficients (e.g., a simple moving average filter)
    b = np.array([0.2, 0.5, 0.2])  # A simple moving average filter as an example
    a = np.array([1.0])  # No denominator coefficients in this simple example

    # Apply the manual filtfilt process
    filtered_signal = manual_filtfilt(b, a, x)

    print("Original Signal: \n", x)
    print("Filtered Signal: \n", filtered_signal)
