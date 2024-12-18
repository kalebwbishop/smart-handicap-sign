import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SkeletonLoader = ({ width, height, borderRadius = 4 }: { width: number, height: number, borderRadius: number }) => {
    const shimmerAnimation = useRef(new Animated.Value(-1)).current;
    const containerRef = useRef(null);

    useEffect(() => {
        Animated.loop(
            Animated.timing(shimmerAnimation, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const shimmerTranslate = shimmerAnimation.interpolate({
        inputRange: [-1, 1],
        outputRange: [-350, 350],
    });

    return (
        <View style={[styles.skeletonContainer, { height, borderRadius }]}
        ref = {containerRef}>
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        transform: [{ translateX: shimmerTranslate }],
                    },
                ]}
            >
                <LinearGradient
                    colors={['#e0e0e0', '#f5f5f5', '#e0e0e0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.linearGradient}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    skeletonContainer: {
        backgroundColor: '#e0e0e0',
        overflow: 'hidden',
    },
    linearGradient: {
        flex: 1,
    },
});

export default SkeletonLoader;
