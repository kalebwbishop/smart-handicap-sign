import { View, Text } from "react-native";
import { Children, type ReactNode } from "react";
import { layout, spacing, shadows } from '../theme/spacing';
import { colors } from '../theme/colors';


interface SectionCardProps {
    title: string;
    children: ReactNode;
}

export default function SectionCard({
    title,
    children,
}: SectionCardProps) {   
    return (
        <>
            <Text>{title.toUpperCase()}</Text>

            <View
                style={{
                    backgroundColor: colors.white,
                    borderRadius: layout.borderRadiusMd,
                    paddingHorizontal: spacing.lg,
                    marginTop: spacing.md,
                    marginBottom: spacing.lg,
                    borderWidth: 1,
                    borderColor: colors.divider,
                    ...shadows.card,
                }}
            >
                {Children.map(children, (child, index) => (
                    (
                        <View
                            key={index}
                            style={{
                                marginHorizontal: -spacing.lg,
                                paddingVertical: spacing.md,
                                ...(index > 0 && {
                                    borderTopWidth: 1,
                                    borderTopColor: colors.divider,
                                }),
                            }}
                        >
                            <View style={{ marginHorizontal: spacing.lg }}>
                                {child}
                            </View>
                        </View>
                    )
                ))}
            </View>
        </>
    );
}
