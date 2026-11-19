import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken } from './api';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function initPushNotifications(): Promise<string | null> {
    try {
        if (!Device.isDevice) return null;

        if (Platform.OS === 'android') {
            try {
                await Notifications.setNotificationChannelAsync('match-alerts', {
                    name: 'Live Match Alerts',
                    importance: Notifications.AndroidImportance.HIGH,
                    enableVibrate: true,
                });
            } catch {
                // Ignore channel setup errors on Expo Go or restricted Android OEMs
            }
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') return null;

        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

        const tokenData = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
        );

        const token = tokenData.data;
        await registerPushToken(token).catch(() => { });
        return token;
    } catch {
        return null;
    }
}