import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import axios from 'axios';

export default function WifiSetupScreen() {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');

  const sendCredentials = async () => {
    try {
      setStatus('Connecting...');
      const response = await axios.post('http://192.168.4.1:5000/set_wifi', {
        ssid,
        password,
      });
      if (response.status === 200) {
        setStatus('Connection successful!');
      } else {
        setStatus('Failed to connect. Try again.');
      }
    } catch (error) {
      console.error(error);
      setStatus('Error connecting to device.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to Wi-Fi</Text>
      <TextInput
        label="SSID"
        value={ssid}
        onChangeText={(text) => setSsid(text)}
        style={styles.input}
      />
      <TextInput
        label="Password"
        value={password}
        secureTextEntry
        onChangeText={(text) => setPassword(text)}
        style={styles.input}
      />
      <Button mode="contained" onPress={sendCredentials} style={styles.button}>
        Connect
      </Button>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    marginBottom: 20,
  },
  button: {
    marginBottom: 20,
  },
  status: {
    marginTop: 20,
    textAlign: 'center',
  },
});
