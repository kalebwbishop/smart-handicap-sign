import './polyfills'; // must be first — patches window.location before axios reads it
console.log('[BOOT] polyfills loaded');

import { registerRootComponent } from 'expo';
console.log('[BOOT] expo loaded');

import { LogBox, Platform } from 'react-native';
console.log('[BOOT] react-native loaded, Platform.OS =', Platform.OS);

import App from './App';
console.log('[BOOT] App module loaded');

// Global unhandled error/rejection logging
if (typeof globalThis !== 'undefined') {
    const origHandler = globalThis.ErrorUtils?.getGlobalHandler?.();
    globalThis.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
        console.error('[GLOBAL ERROR]', isFatal ? 'FATAL' : 'non-fatal', error?.message || error);
        console.error('[GLOBAL ERROR] stack:', error?.stack?.substring(0, 500));
        if (origHandler) origHandler(error, isFatal);
    });
}

// Track unhandled promise rejections
const originalPromise = Promise;
if (typeof global !== 'undefined') {
    const tracking = global.__unhandledRejectionTracking;
    if (!tracking) {
        global.__unhandledRejectionTracking = true;
        const _then = Promise.prototype.then;
        // Log when promises are rejected without handlers
        console.log('[BOOT] Unhandled rejection tracking installed');
    }
}

console.log('[BOOT] Registering root component...');
registerRootComponent(App);
console.log('[BOOT] registerRootComponent called');
