import React from "react";
import { Image, Pressable, View } from "react-native";
import { useAuth0 } from "react-native-auth0";
import { useRouter, Link } from 'expo-router';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { set } from "@/redux/authSlice";

import ScreenWrapper from "@/components/ScreenWrapper";
import KBTypography from "@/components/KBTypography";
import { HSpacer } from "@/components/Spacer";


export default function UserSettings() {
    const dispatch = useDispatch<AppDispatch>();
    const { user, clearSession } = useAuth0();
    const router = useRouter();

    const SignOutButton = () => {
        const onPress = async () => {
            try {
                await clearSession({ federated: false });
                dispatch(set(null));
                router.replace('/Auth');

            } catch (e) {
                console.log(e);
            }
        };

        return <Pressable
            style={{
                backgroundColor: '#E45858',
                width: '100%',
                flexDirection: 'row',
                justifyContent: 'center',
                padding: 20,
                borderRadius: 20,
            }} onPress={onPress}>
            <KBTypography variant="button">Sign Out</KBTypography>
        </Pressable>;
    };

    return (
        <ScreenWrapper>
            <Link href='..'>
                <AntDesign name="arrowleft" size={24} color="#FFFFFF" />
            </Link>
            <View style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
                <Image style={{ height: 250, aspectRatio: 1, borderRadius: 125 }} source={user?.picture ? { uri: user.picture } : require('../assets/images/example_user.png')} />
                <HSpacer size={20} />
                <View
                    style={{
                        backgroundColor: '#FFFFFF33',
                        width: '100%',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        padding: 20,
                        borderRadius: 20,
                    }}>
                    <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                        <KBTypography variant="subheader" style={{ fontSize: 30 }}>{user?.name || 'Loading...'}</KBTypography>
                        <KBTypography variant="body">ER RN</KBTypography>
                        <KBTypography variant="body" >Blanchard Valley Hospital System</KBTypography>
                    </View>
                </View>
                <HSpacer size={20} />
                <SignOutButton />
            </View>
        </ScreenWrapper>
    );
}