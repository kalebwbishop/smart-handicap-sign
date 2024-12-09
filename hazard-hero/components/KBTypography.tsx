import React, { ReactNode, useMemo } from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';

interface KBTypographyProps {
    variant?:
    'title' |
    'subtitle' |
    'subheader' |
    'body' |
    'button';
    children: ReactNode;
    style?: TextStyle;
}

export default function KBTypography({ variant = 'body', children, style }: KBTypographyProps) {

    const dynamicStyles = useMemo(() => {
        switch (variant) {
            case 'title':
                return { fontFamily: 'PoppinsSemiBold', fontSize: 40 };
            case 'subtitle':
                return { fontFamily: 'PoppinsRegular', fontSize: 24 };
            case 'subheader':
                return { fontFamily: 'PoppinsSemiBold', fontSize: 12 };
            case 'body':
                return { fontFamily: 'PoppinsRegular', fontSize: 16 };
            case 'button':
                return { fontFamily: 'PoppinsSemiBold', fontSize: 20 };
            default:
                return { fontFamily: 'PoppinsRegular', fontSize: 12 };
        }
    }, [variant]);

    const styles = StyleSheet.create({
        text: {
            color: '#FFFFFF',
            ...dynamicStyles,
        },
    });

    return (
        <Text style={[styles.text, style]}>{children}</Text>
    );
}