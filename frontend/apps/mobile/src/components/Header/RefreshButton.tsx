import React, { useCallback, useEffect, useRef, useState } from "react"
import {
    StyleSheet,
    Animated,
    Easing,
    Pressable,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { colors } from '../../theme/colors';
import { useIsFocused } from "@react-navigation/native";
import { devicesAPI, notificationAPI } from "@/api/api";
import { useAuthStore } from "@/store/authStore";
import { useDeviceStore } from "@/store/deviceStore";
import { useNotificationStore } from "@/store/notificationStore";


const POLL_INTERVAL_MS = 30_000;

export default function RefreshButton() {
    const { token, ensureFreshSession } = useAuthStore();
    const isFocused = useIsFocused();
    const [refreshingState, setRefreshingState] = useState<"idle" | "refreshing" | "stopping">("idle");
    const nextRefreshAt = useRef(Date.now() + POLL_INTERVAL_MS);
    const rotationAnim = useRef(new Animated.Value(0)).current;

    function handleRefresh() {
        if (refreshingState === "refreshing" || refreshingState === "stopping") return;
        fetchData();
        setRefreshingState("refreshing");
        setTimeout(() => setRefreshingState("stopping"), 1400);
        nextRefreshAt.current = Date.now() + POLL_INTERVAL_MS;
    }


    const fetchData = useCallback(
        async () => {
            try {
                // await ensureFreshSession();
                const [devices, latestNotifications, preferences] =
                    await Promise.all([
                        devicesAPI.list(undefined, {
                            timeout: 10_000,
                        }),
                        notificationAPI.getNotifications(undefined, {
                            timeout: 10_000,
                        }),
                        notificationAPI.getPreferences(),
                    ]);

                    useDeviceStore.getState().setDevices(devices);
                    // useNotificationStore.getState().setNotifications(latestNotifications);
                    // useNotificationStore.getState().setNotificationPreferences(preferences);

                    console.log("Fetched data:", { devices, latestNotifications, preferences });
                }
                catch (error) {
                    console.error("Failed to fetch data:", error);
                }
        },
        [ensureFreshSession],
    );

    useEffect(() => {
            const delay = Math.max(0, nextRefreshAt.current - Date.now());
            const timeout = setTimeout(() => {
                void handleRefresh();
            }, delay);
    
            return () => clearTimeout(timeout);
        }, [handleRefresh]);

    useEffect(() => {
        if (refreshingState === "refreshing") {
            Animated.loop(
                Animated.timing(rotationAnim, {
                    toValue: 1,
                    duration: 1200,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
        } else if (refreshingState === "stopping") {
            rotationAnim.stopAnimation((value: number) => {
                Animated.timing(rotationAnim, {
                    toValue: 1,
                    duration: Math.max(0, 1200 - value * 1200),
                    easing: Easing.linear,
                    useNativeDriver: true,
                }).start(() => setRefreshingState("idle"));
            });
        } else {
            rotationAnim.setValue(0);
        }
    }, [refreshingState]);

    useEffect(() => {
        console.log("isFocused changed:", isFocused);
        if (isFocused) {
            handleRefresh();
        }
    }, [isFocused]);

    return <Pressable
        style={styles.headerButtonBackground}
        onPress={handleRefresh}>
        <Animated.View
            style={{ transform: [{ rotate: rotationAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
        >
            <Feather
                name="refresh-cw"
                size={20}
                color={refreshingState === "refreshing" ? colors.primaryLight : colors.textSecondary}
                style={styles.headerButton}
            />
        </Animated.View>
    </Pressable>
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
    logo: { width: 60, height: 60 },
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