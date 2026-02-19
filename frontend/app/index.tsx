import { Redirect } from 'expo-router';

export default function Index() {
    // In a real app, we'd check if the user is authenticated here
    // For now, let's redirect to LoginScreen or Feed
    return <Redirect href="/login" />;
}
