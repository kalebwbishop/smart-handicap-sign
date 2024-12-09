import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';

import ScreenWrapper from '@/components/ScreenWrapper';
import KBTypography from '@/components/KBTypography';
import { HSpacer, WSpacer } from '@/components/Spacer';
import { Link } from 'expo-router';

export default function SignPage() {
    return (
        <ScreenWrapper>
            <Link href='/SignList'>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <AntDesign name="arrowleft" size={24} color="#FFFFFF" />
                        <WSpacer size={10} />
                        <KBTypography variant='title'>1</KBTypography>
                    </View>

                    <KBTypography variant='subtitle'>Emergency Room</KBTypography>
                </View>
            </Link>

            <HSpacer size={40} />

            <View style={styles.container}>
                <KBTypography variant='subtitle'>Assistance Required</KBTypography>
                <HSpacer size={20} />
                <View style={styles.button}>
                    <KBTypography variant='button' style={{ color: '#000000', textAlign: 'center' }}>{`Send Assistance\nConfirmation`}</KBTypography>
                </View>
                <HSpacer size={20} />
                <Image style={styles.locationImage} source={require('../../assets/images/example_sign_location.png')} />

            </View>

        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF33',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 10,
        alignItems: 'center',
    },
    button: {
        backgroundColor: '#E4D958',
        borderRadius: 10,
        padding: 10,
        width: '100%',
    },
    locationImage: {
        width: '100%',
        height: 370,
        resizeMode: 'stretch',
        borderRadius: 10,
    },
});