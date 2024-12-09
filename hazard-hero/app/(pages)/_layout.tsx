import { Tabs } from 'expo-router';

export default function PageLayout() {
    return (
        <Tabs screenOptions={{
            header: () => null,
            tabBarStyle: {
                display: 'none',
            },


        }}>
            <Tabs.Screen name="Sign" />
            <Tabs.Screen name="SignList" />
        </Tabs>
    );
}
