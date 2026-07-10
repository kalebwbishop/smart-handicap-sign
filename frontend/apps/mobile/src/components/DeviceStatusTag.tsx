import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

interface DeviceStatusTagProps {
    status: 'available' | 'offline' | 'unknown';
}

export default function DeviceStatusTag({ status }: DeviceStatusTagProps) {
    const colors = {
        available: {
            primary: '#00d492',
            background: '#142e2f',
        },
        offline: {
            primary: 'red',
            background: '#2f1414'
        },
        unknown: {
            primary: 'gray',
            background: '#14142e'
        },
    }

    const primaryColor = colors[status.toLowerCase() as keyof typeof colors].primary;
    const backgroundColor = colors[status.toLowerCase() as keyof typeof colors].background;

    return (
        <View style={[styles.badge, { backgroundColor, borderColor: primaryColor, borderWidth: 1 }]}>
            <View style={[{ backgroundColor: primaryColor, width: 8, height: 8, borderRadius: 4, marginRight: 4 }]}/>
            <Text style={[styles.badgeText, { color: primaryColor }]}>
                {status}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 100,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
});