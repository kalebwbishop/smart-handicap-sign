import KBTypography from '@/components/KBTypography';
import ScreenWrapper from '@/components/ScreenWrapper';
import { HSpacer } from '@/components/Spacer';
import React, { useEffect, useState } from 'react';
import { useAuth0 } from 'react-native-auth0';
import { View, Image, Pressable } from 'react-native';
import { useDispatch } from 'react-redux';
import { set } from '@/redux/authSlice';
import { AppDispatch } from '@/redux/store';
import { router } from 'expo-router';

export default function AuthScreen({ loginButtonVisible = true, children }: { loginButtonVisible?: Boolean, useAuth0: any, children?: React.ReactNode }) {
    const dispatch = useDispatch<AppDispatch>();

    const { user, authorize } = useAuth0();
    const [isLoggedIn, setIsLoggedIn] = useState(!!user);

    const LoginButton = () => {
        const onPress = async () => {
            try {
                const token = await authorize({
                    audience: 'http://172.20.10.2:7071/'
                });
                dispatch(set(token?.accessToken));
                console.log('token', token?.accessToken);
                setIsLoggedIn(true);
            } catch (e) {
                console.log(e);
            }
        };

        return (
            <Pressable
                style={{
                    backgroundColor: '#FFFFFF33',
                    width: '100%',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    padding: 10,
                    borderRadius: 20,
                    opacity: loginButtonVisible ? 1 : 0
                }} onPress={onPress}>
                <KBTypography variant="button">Login / Sign Up</KBTypography>
            </Pressable>
        );
    };

    useEffect(() => {
        setIsLoggedIn(false);
    }, []);

    useEffect(() => {
        if (isLoggedIn && user) {
            router.replace('/');
        }
    }, [isLoggedIn, user]);

    return (
        <ScreenWrapper>
            <View
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <Image
                    style={{
                        width: 150,
                        height: 150,
                    }}
                    source={require('../assets/images/logo.png')}
                />
                <HSpacer size={50} />
                <KBTypography variant="title">Hazard Hero</KBTypography>
                <HSpacer size={50} />
                <LoginButton />
            </View>
        </ScreenWrapper>
    );
}
