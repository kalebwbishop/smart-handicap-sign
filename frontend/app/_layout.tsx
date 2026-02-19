import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            staleTime: 1000 * 60 * 5,
        },
    },
});

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
                    <Stack screenOptions={{ headerShown: false }} />
                    <StatusBar style="auto" />
        </QueryClientProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Platform.OS === 'web' ? '#f3f4f6' : '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    appContainer: {
        flex: 1,
        width: '100%',
        backgroundColor: '#fff',
    },
    webAppContainer: {
        maxWidth: 480,
        height: '100%',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
});
