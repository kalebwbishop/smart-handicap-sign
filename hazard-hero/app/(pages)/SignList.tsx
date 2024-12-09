import React, { useMemo } from 'react';
import { View, Image, StyleSheet, ScrollView } from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import { HSpacer } from '../../components/Spacer';
import KBTypography from '@/components/KBTypography';
import { Link } from 'expo-router';

export default function SignListPage() {
    return (
        <ScreenWrapper>
            <KBTypography variant='title'>Signs</KBTypography>
            <HSpacer size={20} />
            <SignList />
        </ScreenWrapper>
    );
}

type Sign = {
    name: string;
    location: string;
    state: 'Ready' | 'Assist' | 'Offline';
};

function SignListComponent({ sign }: { sign: Sign }) {
    const { name, location, state } = sign;

    const dynamicStyles = useMemo(() => {
        switch (state) {
            case 'Ready':
                return { buttonBg: '#66B057', textColor: '#FFFFFF' };
            case 'Assist':
                return { buttonBg: '#E4D958', textColor: '#000000' };
            case 'Offline':
                return { buttonBg: '#E45858', textColor: '#FFFFFF' };
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
            color: dynamicStyles.textColor,
        },
    });

    return (
        <Link href={'/Sign'}>
            <View style={styles.container}>

                <View style={styles.textContainer}>
                    <View style={styles.nameLocationContainer}>
                        <KBTypography style={styles.name}>{name}</KBTypography>
                        <KBTypography style={styles.location}>{location}</KBTypography>
                    </View>

                    <View style={styles.stateButtonContainer}>
                        <KBTypography variant='button' style={styles.state}>{state}</KBTypography>
                    </View>
                </View>

                <Image style={styles.locationImage} source={require('../../assets/images/example_sign_location.png')} />
            </View>
        </Link>
    );
}

function SignList() {
    const signs: Sign[] = [
        { name: '1', location: 'Emergency Room', state: 'Ready' },
        { name: '2', location: 'Emergency Room', state: 'Assist' },
        { name: '3', location: 'Emergency Room', state: 'Offline' },
        { name: '4', location: 'Emergency Room', state: 'Ready' },
        { name: '5', location: 'Emergency Room', state: 'Assist' },
        { name: '6', location: 'Emergency Room', state: 'Offline' },
    ];

    const AssistSigns = signs.filter((sign) => sign.state === 'Assist');
    const OfflineSigns = signs.filter((sign) => sign.state === 'Offline');
    const ReadySigns = signs.filter((sign) => sign.state === 'Ready');

    return (
        <ScrollView>
            {AssistSigns.map((sign, idx) => (
                <View key={`sign-${idx}-${sign.name}-${sign.location}`}>
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

            {OfflineSigns.map((sign, idx) => (
                <View key={`sign-${idx}-${sign.name}-${sign.location}`}>
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

            {ReadySigns.map((sign, idx) => (
                <View key={`sign-${idx}-${sign.name}-${sign.location}`}>
                    <SignListComponent sign={sign} />
                    <HSpacer size={20} />
                </View>
            ))}
        </ScrollView>
    );
}
