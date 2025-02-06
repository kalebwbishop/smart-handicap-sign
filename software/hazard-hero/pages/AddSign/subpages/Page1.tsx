import React, { useCallback, useEffect } from "react";
import { View, Image, Button, Linking, AppState, AppStateStatus } from "react-native";
import { useNavigation } from "@react-navigation/native";

import KWBTypography from "@/components/KWBTypography";
import { KWBNavProp } from "@/types";

export default function Page1() {
    const navigation = useNavigation<KWBNavProp>();

    const handleIOTGetRoot = useCallback(() => {
        console.log("Fetching data...");
        fetch('http://192.168.4.1')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');

                return response.text();
            })
            .then(data => {
                if (data === '5aa41db4-d84c-4a8c-9344-b636e67bebb7') {
                    navigation.navigate('AddSignPage', { page: 2 });
                }
            })
            .catch(error => console.error("Error fetching data:", error));
    }, [navigation]);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                handleIOTGetRoot();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, []);


    const openWifiSettings = () => {
        Linking.openSettings();
    };

    return (
        <View style={{ alignItems: 'center' }}>
            <View style={{ alignSelf: 'flex-start', marginBottom: 16 }}>
                <KWBTypography>1. Tap the **"Open Settings"** button below.</KWBTypography>
                <KWBTypography style={{ marginLeft: 16 }}>• On **iPhone**, this will open the **Settings app**.</KWBTypography>
                <KWBTypography style={{ marginLeft: 16 }}>• On **Android**, it will take you directly to **Wi-Fi settings**.</KWBTypography>

                <KWBTypography style={{ marginTop: 8 }}>2. In **Wi-Fi settings**, look for a network named **"Handicap Sign"** and connect to it.</KWBTypography>
                <KWBTypography style={{ marginTop: 8 }}>3. Once connected, return to this app to continue.</KWBTypography>
            </View>

            <Button title="Open Settings" onPress={openWifiSettings} />

            <Image
                source={require('@/assets/images/ios-wifi-settings-example.jpg')}
                style={{ width: '100%', height: 413, borderRadius: 8, marginTop: 16 }}
            />
        </View>
    );
}
