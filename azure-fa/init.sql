-- Create the hsigns table
CREATE TABLE hsigns (
    hsign_id INT IDENTITY(1,1) PRIMARY KEY,  -- Unique ID for each handicap sign
    name VARCHAR(50) NOT NULL,              -- Name of the handicap sign
    location VARCHAR(50) NOT NULL,          -- Location of the handicap sign
    status VARCHAR(50) NOT NULL DEFAULT 'Offline'  -- Status of the handicap sign, default to offline
);

-- Create the users table
CREATE TABLE users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,  -- Unique ID for each user
    auth_id VARCHAR(50) NOT NULL            -- Auth ID of the user
);

-- Create the output_devices table
CREATE TABLE output_devices (
    output_device_id INT IDENTITY(1,1) PRIMARY KEY,  -- Unique ID for each output device
    expo_push_token VARCHAR(100) NOT NULL           -- Expo push token of the output device
);

-- Create the relationship table between users and hsigns
CREATE TABLE user_hsign_mm (
    user_id INT NOT NULL,
    hsign_id INT NOT NULL,
    PRIMARY KEY (user_id, hsign_id),
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (hsign_id) REFERENCES hsigns (hsign_id) ON DELETE CASCADE
);

-- Create the relationship table between users and output_devices
CREATE TABLE user_output_device_mm (
    user_id INT NOT NULL,
    output_device_id INT NOT NULL,
    PRIMARY KEY (user_id, output_device_id),
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (output_device_id) REFERENCES output_devices (output_device_id) ON DELETE CASCADE
);
