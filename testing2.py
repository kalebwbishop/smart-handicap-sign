from scipy.signal import butter, filtfilt

input_intensity = [ 4.23549382e-02,  2.67659335e-01, -1.06510556e+00, -1.06538107e+00,
        9.54024841e-01,  1.63499303e-01, -6.48702346e-01,  1.04438188e+00,
       -1.41020575e+00,  9.96586404e-01,  1.22616654e+00,  1.68901570e+00,
       -1.30502103e+00, -1.64713090e+00, -9.37615002e-01, -9.70928990e-01,
        1.85448518e+00,  6.86353545e-01, -4.16779354e-01, -5.52035760e-01,
        8.35540430e-01, -1.51172712e+00,  5.07450415e-01,  5.95550392e-01,
       -4.59241427e-01, -6.01330412e-01,  3.28887172e-01,  6.59530663e-01,
        5.96787466e-01, -8.47809003e-01,  7.88635222e-01, -1.08618844e+00,
       -1.32372300e+00, -3.26342795e-01,  1.19024193e+00,  1.30045337e+00,
        3.87814393e-01,  2.06933955e+00, -1.10742899e+00,  4.75052716e-01,
        2.35916276e-01,  6.78561877e-01, -8.39694007e-01,  3.49449970e-02,
       -3.51217554e-01, -3.42437706e-01,  1.32902904e-01,  4.74326355e-01,
       -6.73542982e-01,  1.92606226e-01,  3.78047700e-01, -4.09115198e-01,
       -1.63340328e+00, -9.25916000e-01, -1.09934620e+00, -1.13627007e+00,
        8.24813533e-01, -1.36595157e-01,  2.11965758e-01, -1.78551980e-03,
       -4.55268205e-01, -9.81204005e-01, -9.45097350e-01,  1.04997790e+00,
       -3.06511516e-01, -3.04338311e-01,  1.30955459e+00,  5.41918271e-01,
       -3.34494338e-02, -1.21124282e+00,  8.96043104e-01, -5.45467906e-01,
        3.45931528e-01, -2.71320669e-01,  4.35357417e-03,  8.55189015e-01,
       -4.46237613e-01,  7.35720226e-01,  5.91457303e-01,  8.49427893e-01,
        1.09127336e+00,  9.99842296e-01, -5.56826753e-01,  1.19195071e-01,
        4.07292708e-01, -7.82870661e-01,  3.60339836e-01, -7.02728659e-02,
        7.99703041e-02,  8.80995452e-01,  1.36840902e+00,  6.49176950e-01,
       -2.53699566e+00, -2.46477268e-01, -8.15063503e-01, -1.12232303e+00,
       -6.84154439e-01, -3.15648667e+00, -1.47132628e+00,  3.99604900e-01]

def butter_bandpass(lowcut, highcut, fs, order=4):
    nyquist = 0.5 * fs
    low = lowcut / nyquist
    high = highcut / nyquist
    b, a = butter(order, [low, high], btype='band')
    return b, a

# Apply the bandpass filter to the signal
def bandpass_filter(input_intensity, lowcut, highcut, fs, order=4):
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    y = filtfilt(b, a, input_intensity)
    return y

def my_filter(input_intensity):
    b = [ 5.84514243e-08,  0.00000000e+00, -2.33805697e-07,  0.00000000e+00,
  3.50708546e-07,  0.00000000e+00, -2.33805697e-07,  0.00000000e+00,
  5.84514243e-08]  # Example coefficients, replace with your own
    a = [  1., -7.70008538, 26.15293176, -51.16503217, 63.05575405,
 -50.12557952, 25.10110048, -7.24026236, 0.92118193]  # Example coefficients, replace with your own

        # Initialize filter state variables
    y = [0] * len(input_intensity)  # Filtered data output
    z = [0] * max(len(b), len(a))  # Filter memory for IIR filter

    # Apply IIR filtering process
    for i in range(len(input_intensity)):
        # Direct form II transposed structure (IIR)
        y[i] = b[0] * input_intensity[i] + z[0]
        for j in range(1, len(b)):
            z[j - 1] = b[j] * input_intensity[i] - a[j] * y[i] + (z[j] if j < len(z) else 0)
    
    return y

print(butter_bandpass(1.4, 1.6, 1000 / 25)[0])
print(butter_bandpass(1.4, 1.6, 1000 / 25)[1])
print(bandpass_filter(input_intensity, 1.4, 1.6, 1000 / 25)[0] == my_filter(input_intensity, 1000 / 25))
