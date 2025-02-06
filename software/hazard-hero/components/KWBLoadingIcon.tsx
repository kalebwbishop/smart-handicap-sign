import React, { useEffect, useRef } from "react";
import { View, Animated, Easing } from "react-native";
import AntDesign from '@expo/vector-icons/AntDesign';

const KWBLoadingIcon = () => {
    const rotateAnim1 = useRef(new Animated.Value(0)).current;
    const rotateAnim2 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const createLoop = (anim: Animated.AnimatedValue, duration: number, reverse = false) => {
            Animated.loop(
                Animated.timing(anim, {
                    toValue: 1,
                    duration,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
        };

        createLoop(rotateAnim1, 1200);
        createLoop(rotateAnim2, 1800, true);
    }, []);

    const rotateInterpolation1 = rotateAnim1.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
    });

    const rotateInterpolation2 = rotateAnim2.interpolate({
        inputRange: [0, 1],
        outputRange: ["360deg", "0deg"],
    });

    return (
        <View style={{ height: 60, justifyContent: "center", alignItems: "center" }}>
            {/* Outer rotating icon */}
            <Animated.View style={{ position: 'absolute', transform: [{ rotate: rotateInterpolation1 }] }}>
                <AntDesign name="loading1" size={50} color="white" />
            </Animated.View>

            {/* Inner rotating icon */}
            <Animated.View style={{ position: 'absolute', transform: [{ rotate: rotateInterpolation2 }] }}>
                <AntDesign name="loading2" size={30} color="lightgray" />
            </Animated.View>
        </View>
    );
};

export default KWBLoadingIcon;
