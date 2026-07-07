import React from "react"
import {
    Text,
    View,
    Image,
    StyleSheet,
    Pressable
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { useNotificationStore } from '../../store/notificationStore';
import RefreshButton from "./RefreshButton";

type HeaderProps = {
    headerTitle: string;
    onPressRequests?: () => void;
};

export default function Header({ headerTitle, onPressRequests }: HeaderProps) {
    const notificationCount = useNotificationStore((s) => s.unreadCount);
    const insets = useSafeAreaInsets();

    return (
        <View style={[{ backgroundColor: colors.white, paddingTop: insets.top, borderBottomColor: colors.divider, borderBottomWidth: 1 }, styles.container]}>
            {/* Logo section */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                <Image
                    source={require('../../../assets/icon.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <View style={{ alignItems: 'flex-start', justifyContent: 'center' }}>
                    <Text style={{ color: colors.textSecondary, fontFamily: 'Montserrat_600SemiBold', fontSize: 12 }}>
                        HAZARD HERO
                    </Text>
                    <Text style={{ color: colors.textPrimary, fontFamily: 'Montserrat_600SemiBold', fontSize: 18 }}>
                        {headerTitle}
                    </Text>
                </View>
            </View>

            {/* Header buttons section */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <RefreshButton />
                <Pressable
                    style={styles.headerButtonBackground}
                    onPress={onPressRequests}
                >
                    <Feather
                        name="bell"
                        size={20}
                        color={colors.textSecondary}
                        style={styles.headerButton}
                    />
                    {notificationCount > 0 && (
                        <View style={styles.notificationBadge}>
                            <Text style={styles.notificationText}>{notificationCount}</Text>
                        </View>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        marginVertical: 8,
    },
    headerButtonBackground: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.offWhite,
        borderRadius: 50,
        width: 40,
        height: 40,
    },
    headerButton: {
        padding: 8,
    },
    logo: { width: 60, height: 60, backgroundColor: 'red' },
    notificationBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: 'red',
        borderRadius: 8,
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notificationText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    }
});