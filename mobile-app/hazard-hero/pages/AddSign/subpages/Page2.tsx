import React, { useState, useEffect } from "react";
import { Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import KWBTypography from "@/components/KWBTypography";
import { KWBNavProp } from "@/types";
import KWBLoadingIcon from "@/components/KWBLoadingIcon";

type iotResponse = {
    ssid: string;
    rssi: number;
}

export default function Page2() {
    const navigation = useNavigation<KWBNavProp>();

    const [data, setData] = useState<iotResponse[]>([{ "ssid": "Minster House", "rssi": -60 }, { "ssid": "Minster House 5G", "rssi": -60 }]);
    const [loading, setLoading] = useState(true);

    const handleIOTGetAvailableNetworks = () => {
        fetch('http://192.168.4.1/availableNetworks')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');

                return response.json();
            }
            )
            .then(data => {
                console.log(data);
                setData(data);
                setLoading(false);
            })
            .catch(error => {
                console.error('Error:', error);
                setLoading(false);
            });
    }

    useEffect(() => {
        handleIOTGetAvailableNetworks();
    }, []);

    const handleSSIDSelection = (ssid: string) => {
        navigation.push('AddSignPage', { page: 3, ssid: ssid });
    }

    if (true) {
        return <KWBLoadingIcon />;
    }

    return (<>
        {data.map((network, index) => {
            return (
                <Pressable
                    onPress={() => handleSSIDSelection(network.ssid)}
                    style={{
                        backgroundColor: '#3A3941',
                        padding: 16,
                        marginBottom: 16,
                        borderRadius: 8,
                        borderStyle: "solid",
                        borderWidth: 2,
                        borderColor: "#FF7500A0",
                    }}>
                    <KWBTypography key={index}> {network.ssid} </KWBTypography>
                </Pressable>
            )
        })}
    </>
    );
}