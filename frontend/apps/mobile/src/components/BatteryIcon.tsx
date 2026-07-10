import React from 'react'
import Feather from "@expo/vector-icons/Feather";
import { View, StyleSheet } from 'react-native';

interface BatteryIconProps {
    batteryPercentage: number;
    size?: number;
}

export default function BatteryIcon({ batteryPercentage, size = 24 }: BatteryIconProps) {
    const clampedPercentage = Math.max(0, Math.min(100, batteryPercentage));
    const batteryBodyWidth = size * 0.67;
    const batteryBodyHeight = size * 0.43;

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <View
                style={[
                    styles.batteryFill,
                    {
                        width: (clampedPercentage / 100) * batteryBodyWidth,
                        height: batteryBodyHeight,
                        backgroundColor: clampedPercentage > 20 ? "green" : "red",
                    },
                ]}
            />
            <Feather
                accessibilityLabel="Battery status"
                name="battery"
                size={size}
                color={clampedPercentage > 20 ? "green" : "red"}
                style={styles.icon}
            />
        </View>
    );
}


const styles = StyleSheet.create({
    container: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    batteryFill: {
        position: 'absolute',
        left: '8%',
        bottom: '27%',
        zIndex: 0,
    },
    icon: {
        zIndex: 1,
    },
});