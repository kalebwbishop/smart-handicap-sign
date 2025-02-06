import React from 'react';
import { Pressable, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from "expo-blur";

import { RootParamList } from '../types';
import MainPage from '@/pages/Main';
import AddSignPage from '@/pages/AddSign';

const Stack = createStackNavigator<RootParamList>();

export default function KWBNavigationWrapper() {
    const insets = useSafeAreaInsets();
    const bottom_inset = insets.bottom

    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="AddSignPage"
                screenOptions={{
                    cardStyle: {
                        backgroundColor: '#2F2D34',
                    },
                    headerShown: false,
                }}>
                <Stack.Screen name="MainPage" component={MainPage} />
                <Stack.Screen name="AddSignPage" component={AddSignPage} initialParams={{ page: 2, ssid: '123' }} />
            </Stack.Navigator>
            <BlurView intensity={50} tint="default">
                <Pressable>
                    <Text style={{ paddingBottom: bottom_inset, backgroundColor: 'transparent' }}>Add</Text>
                </Pressable>
            </BlurView>
        </NavigationContainer>
    );
}