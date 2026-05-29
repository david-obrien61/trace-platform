import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@trace/shared': path.resolve(__dirname, '../shared/src'),
      'react-native': 'react-native-web',
      '@react-native-async-storage/async-storage': path.resolve(__dirname, './stubs/asyncStorage.js'),
      '@react-native-ml-kit/text-recognition': path.resolve(__dirname, './stubs/empty.js'),
      'expo-haptics': path.resolve(__dirname, './stubs/haptics.js'),
      'expo-camera': path.resolve(__dirname, './stubs/camera.js'),
      'expo-audio': path.resolve(__dirname, './stubs/audio.js'),
      'expo-dev-client': path.resolve(__dirname, './stubs/empty.js'),
      'expo': path.resolve(__dirname, './stubs/empty.js'),
      'lucide-react-native': 'lucide-react',
    },
    extensions: ['.web.js', '.web.jsx', '.web.ts', '.web.tsx', '.js', '.jsx', '.ts', '.tsx'],
  },
  optimizeDeps: {
    exclude: ['lucide-react-native'],
  },
})
