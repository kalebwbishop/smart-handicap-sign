import React, { useState, useRef } from "react";
import { Pressable, TextInput, View } from "react-native";

import KWBTypography from "@/components/KWBTypography";

interface Page3Props {
    ssid?: number;
}

export default function Page3({ ssid }: Page3Props) {
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState("");
    const [buttonHeight, setButtonHeight] = useState<number | undefined>(undefined);

    const inputRef = useRef<TextInput>(null);

    const handleIOTPostSave = () => {
        if (!ssid) return;

        if (!password) return;


        fetch("http://192.168.4.1/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: `ssid=${encodeURIComponent(ssid)}&password=${encodeURIComponent(password)}`
        })
            .then(response => response.text())
            .then(data => console.log("Response:", data))
            .catch(error => console.error("Error:", error));
    }

    if (loading) {
        return <KWBTypography>Loading...</KWBTypography>;
    }

    return (<>
        <Pressable
            onPress={() => inputRef.current?.focus()}
            style={{
                backgroundColor: '#3A3941',
                padding: 16,
                marginBottom: 16,
                height: buttonHeight,
                justifyContent: 'center'
            }}>
            <TextInput
                ref={inputRef}
                style={{
                    color: 'white',
                }}
                placeholder="Enter password"
                secureTextEntry={false}
                value={password}
                onChangeText={setPassword}
            />
        </Pressable>
        <Pressable
            onPress={handleIOTPostSave}
            onLayout={(event) => setButtonHeight(event.nativeEvent.layout.height)} style={{
                backgroundColor: '#3A3941',
                padding: 16,
                marginBottom: 16,
                borderRadius: 8,
                borderStyle: "solid",
                borderWidth: 2,
                borderColor: '#FF7500A0',
                alignItems: 'center'
            }}>
            <KWBTypography>Connect</KWBTypography>
        </Pressable>
    </>
    );
}