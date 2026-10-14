// Keep Expo Router's entry point in the mobile package's resolution scope.
// In the pnpm workspace, resolving it from the workspace root can load a
// different Expo Router peer snapshot than imports inside src/app.
import 'expo-router/entry';
