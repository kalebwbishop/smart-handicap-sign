import React, { useState, useEffect, useMemo } from 'react';
import { View, Image, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useAuth0 } from 'react-native-auth0';
import { useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/redux/store';
import { init } from '@/redux/signsSlice';
import axios from 'axios';
import { AppState, AppStateStatus } from 'react-native';

import ScreenWrapper from '@/components/ScreenWrapper';
import { HSpacer } from '@/components/Spacer';
import KBTypography from '@/components/KBTypography';
import { getRequest } from '@/util/api';
import SkeletonLoader from '@/components/skeletonLoader';

export default function SignListPage() {
    const router = useRouter();
    const { user } = useAuth0();

    return (
        <ScreenWrapper>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pressable onPress={() => { router.push('/Testing') }}>
                <KBTypography variant='title'>Signs</KBTypography>
                </Pressable>
                <Pressable onPress={() => { router.push('/UserSettings') }}>
                    <Image style={{ height: 40, aspectRatio: 1, borderRadius: 20 }} source={user?.picture ? { uri: user.picture } : require('../assets/images/example_user.png')} />
                </Pressable>
            </View>
            <HSpacer size={20} />
            <SignList />
        </ScreenWrapper>
    );
}

type Sign = {
    hsign_id: string;
    name: string;
    location: string;
    status: 'Ready' | 'Assist' | 'Offline';
};

function SignListComponent({ sign }: { sign: Sign }) {
    const { name, location, status } = sign;

    const dynamicStyles = useMemo(() => {
        switch (status) {
            case 'Ready':
                return { buttonBg: '#66B057', textColor: '#FFFFFF' };
            case 'Assist':
                return { buttonBg: '#E4D958', textColor: '#000000' };
            case 'Offline':
                return { buttonBg: '#E45858', textColor: '#FFFFFF' };
            default:
                return { buttonBg: '#CCCCCC', textColor: '#000000' };
        }
    }, [status]);

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
        status: {
            color: dynamicStyles.textColor,
        },
    });

    const router = useRouter();

    const handleNavigate = (id: string) => {
        router.push({
            pathname: '/Sign',
            params: { hsign_id: id },
        });
    };

    return (
        <Pressable onPress={() => handleNavigate(sign.hsign_id)}>
            <View style={styles.container}>

                <View style={styles.textContainer}>
                    <View style={styles.nameLocationContainer}>
                        <KBTypography style={styles.name}>{name}</KBTypography>
                        <KBTypography style={styles.location}>{location}</KBTypography>
                    </View>

                    <View style={styles.stateButtonContainer}>
                        <KBTypography variant='button' style={styles.status}>{status}</KBTypography>
                    </View>
                </View>

                <Image style={styles.locationImage} source={require('../assets/images/example_sign_location.png')} />
            </View>
        </Pressable>
    );
}

function SignList() {
    const [attempted, setAttempted] = useState(false);

    const dispatch = useDispatch<AppDispatch>();
    const signs: { [key: string]: Sign } = useSelector((state: RootState) => state.signs.data);

    const GetHSigns = async () => {
        try {
            const signsData = await getRequest('/api/GetHSigns');
            dispatch(init(signsData));
        } catch (error) {
            console.error('Error fetching signs:', error);
        }
    }

    useEffect(() => {
        if (!attempted && Object.keys(signs).length === 0) {
            setAttempted(true);
            GetHSigns();
        }
    }, [signs]);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                GetHSigns();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [dispatch]);


    const signArray = Object.values(signs);

    const AssistSigns = signArray.filter((sign) => sign.status === 'Assist');
    const OfflineSigns = signArray.filter((sign) => sign.status === 'Offline');
    const ReadySigns = signArray.filter((sign) => sign.status === 'Ready');

    return (
        <ScrollView>
            <SkeletonLoader width={300} height={20} borderRadius={4} />

            {AssistSigns.map((sign, idx) => (
                <View key={`sign-${idx}-${sign.name}-${sign.location}`}>
                    <SignListComponent sign={sign} />
                    <HSpacer size={20} />
                </View>
            ))}

            {AssistSigns.length > 0 && OfflineSigns.length > 0 && (
                <>
                    <View
                        style={{
                            borderBottomColor: '#00000066',
                            borderBottomWidth: 1,
                        }}
                    />
                    <HSpacer size={20} />
                </>
            )}

            {OfflineSigns.map((sign, idx) => (
                <View key={`sign-${idx}-${sign.name}-${sign.location}`}>
                    <SignListComponent sign={sign} />
                    <HSpacer size={20} />
                </View>
            ))}

            {OfflineSigns.length > 0 && ReadySigns.length > 0 && (
                <>
                    <View
                        style={{
                            borderBottomColor: '#00000066',
                            borderBottomWidth: 1,
                        }}
                    />
                    <HSpacer size={20} />
                </>
            )}

            {ReadySigns.map((sign, idx) => (
                <View key={`sign-${idx}-${sign.name}-${sign.location}`}>
                    <SignListComponent sign={sign} />
                    <HSpacer size={20} />
                </View>
            ))}
        </ScrollView>
    );
}
