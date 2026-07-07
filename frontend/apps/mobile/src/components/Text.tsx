import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { typography } from '@/theme/typography';

type TextVariant = keyof typeof typography;

type TextProps = RNTextProps & {
    variant?: TextVariant;
};

export default function Text({ children, style, variant = 'body', ...rest }: TextProps) {
    return (
        <RNText style={[typography[variant], style]} {...rest}>
            {children}
        </RNText>
    );
}