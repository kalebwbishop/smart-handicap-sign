import React from 'react';
import { View } from 'react-native';

export function HSpacer({ size }: { size: number }) {
    return <View style={{ height: size }} />;
}

export function WSpacer({ size }: { size: number }) {
    return <View style={{ width: size }} />;
}
