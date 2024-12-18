import React, { useState, useMemo, useEffect } from 'react';
import { View, Image, StyleSheet, Pressable } from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';

import ScreenWrapper from '@/components/ScreenWrapper';
import KBTypography from '@/components/KBTypography';
import { HSpacer, WSpacer } from '@/components/Spacer';
import { Link } from 'expo-router';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import { set } from '../redux/signsSlice';
import { RootState, AppDispatch } from '../redux/store';
import { useSearchParams } from 'expo-router/build/hooks';

export default function SignPage() {
    const hsign_id = useSearchParams().get('hsign_id');

    if (!hsign_id) {
        return <ScreenWrapper>
            <Link href='..'>
                <KBTypography variant='title'>Sign Not Found</KBTypography>
            </Link>
        </ScreenWrapper>;
    }

    const { name, location, status } = useSelector((state: RootState) => state.signs.data[hsign_id]);
    const dispatch = useDispatch<AppDispatch>();

    const [subtitle, setSubtitle] = useState<string>('');

    const handleButtonPress = () => {
        dispatch(set({
            hsign_id,
            name,
            location,
            'status': 'Ready',
        }));
        setSubtitle('Ready To Help');
        axios.post('http://172.20.10.2:7071/api/SendAssistance', {
            hsign_id,
        }).then((response) => {
            // console.log(response);
        }).catch((error) => {
            // console.log(error);
        });
    };

    useEffect(() => {
        switch (status) {
            case 'Ready':
                setSubtitle('Ready To Help');
                break;
            case 'Assist':
                setSubtitle('Assistance requested');
                break;
            case 'Offline':
                setSubtitle('Offline');
                break;
            default:
                setSubtitle('Unknown');
                break;
        }
    }, [status]);

    return (
        <ScreenWrapper>
            <Link href='..'>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <AntDesign name="arrowleft" size={24} color="#FFFFFF" />
                        <WSpacer size={10} />
                        <KBTypography variant='title'>{name}</KBTypography>
                    </View>

                    <KBTypography variant='subtitle'>{location}</KBTypography>
                </View>
            </Link>

            <HSpacer size={40} />

            <View style={styles.container}>
                <KBTypography variant='subtitle'>{subtitle}</KBTypography>
                {status === 'Assist' && (
                    <>
                        <HSpacer size={20} />
                        <Pressable onPress={() => { handleButtonPress() }} style={styles.button}>
                            <KBTypography variant='button' style={{ color: '#000000', textAlign: 'center' }}>{`Send Assistance\nConfirmation`}</KBTypography>
                        </Pressable>
                    </>
                )}
                <HSpacer size={20} />
                <Image style={styles.locationImage} source={require('../assets/images/example_sign_location.png')} />

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