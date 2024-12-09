import React, { useMemo } from 'react';
import { Text, View, Image, StyleSheet, ScrollView } from 'react-native';

import ScreenWrapper from '../components/ScreenWrapper';
import { HSpacer } from '../components/Spacer';

export default function MainScreen() {
    return (<ScreenWrapper>
        <Text style={styles.header}>Signs</Text>
        <HSpacer size={20} />
        <SignList />
    </ScreenWrapper>)
}

type Sign = {
    name: string;
    location: string;
    state: 'Active' | 'Assist' | 'Offline';
};

function SignListComponent({ sign }: { sign: Sign }) {
    const { name, location, state } = sign;

    const dynamicStyles = useMemo(() => {
        switch (state) {
            case 'Active':
                return { buttonBg: '#66B057', textColor: '#FFFFFF' };
            case 'Assist':
                return { buttonBg: '#FFD700', textColor: '#000000' };
            case 'Offline':
                return { buttonBg: '#FF0000', textColor: '#FFFFFF' };
            default:
                return { buttonBg: '#CCCCCC', textColor: '#000000' };
        }
    }, [state]);

    const styles = StyleSheet.create({
        container: {
            backgroundColor: '#FFFFFF33',
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        textContainer: {
            flex: 1,
            justifyContent: 'space-between',
        },
        nameLocationContainer: {
            paddingHorizontal: 4,
            paddingVertical: 2,
        },
        name: {
            fontSize: 24,
            color: '#FFFFFF',
        },
        locationImage: {
            borderRadius: 10,
            width: 128,
            height: 128,
        },
        location: {
            fontSize: 16,
            color: '#FFFFFF',
        },
        stateButtonContainer: {
            backgroundColor: dynamicStyles.buttonBg,
            flexDirection: 'row',
            justifyContent: 'center',
            borderRadius: 10,
            paddingVertical: 5,
            marginRight: 10,
        },
        state: {
            fontSize: 20,
            color: dynamicStyles.textColor,
        },
    });

    return (
        <View style={styles.container}>
            <View style={styles.textContainer}>
                <View style={styles.nameLocationContainer}>
                    <Text style={styles.name}>{name}</Text>
                    <Text style={styles.location}>{location}</Text>
                </View>

                <View style={styles.stateButtonContainer}>
                    <Text style={styles.state}>{state}</Text>
                </View>
            </View>

            <Image style={styles.locationImage} source={require('../example_sign_location.png')} />
        </View>
    );
}


function SignList() {
    const signs: Sign[] = [
        { name: '1', location: 'Emergency Room', state: 'Active' },
        { name: '2', location: 'Emergency Room', state: 'Assist' },
        { name: '3', location: 'Emergency Room', state: 'Offline' },
        { name: '4', location: 'Emergency Room', state: 'Active' },
    ];

    const AssistSigns = signs.filter((sign) => sign.state === 'Assist');
    const OfflineSigns = signs.filter((sign) => sign.state === 'Offline');
    const ActiveSigns = signs.filter((sign) => sign.state === 'Active');

    return (
        <ScrollView>
            {AssistSigns.map((sign, _) => (
                <View id={`sign-${sign.name}-${sign.location}`}>
                    <SignListComponent sign={sign} />
                    <HSpacer size={20} />
                </View>
            ))}

            <View
                style={{
                    borderBottomColor: '#00000066',
                    borderBottomWidth: 1,
                }}
            />
            <HSpacer size={20} />

            {OfflineSigns.map((sign, _) => (
                <View id={`sign-${sign.name}-${sign.location}`}>
                    <SignListComponent sign={sign} />
                    <HSpacer size={20} />
                </View>
            ))}

            <View
                style={{
                    borderBottomColor: '#00000066',
                    borderBottomWidth: 1,
                }}
            />
            <HSpacer size={20} />

            {ActiveSigns.map((sign, _) => (
                <View id={`sign-${sign.name}-${sign.location}`}>
                    <SignListComponent sign={sign} />
                    <HSpacer size={20} />
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    header: {
        color: '#FFFFFF',
        fontSize: 40,
    },
});