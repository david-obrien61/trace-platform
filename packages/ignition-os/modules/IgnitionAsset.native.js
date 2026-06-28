/**
 * FILE: IgnitionAsset.native.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Fallback placeholder for local asset library under React Native.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Folder } from 'lucide-react-native';

export default function IgnitionAsset({ onBack }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Folder color="#38bdf8" size={32} />
        <Text style={styles.title}>Asset Library</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.warningText}>Desktop Only Feature</Text>
        <Text style={styles.descText}>
          The Asset Library and hardware scanning dashboard are optimized for desktop layout and local PC storage.
        </Text>
        <Text style={styles.descText}>
          Please access the Asset Library via the desktop web browser terminal.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>RETURN TO DASHBOARD</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#020617' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 40, gap: 10 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  warningText: { color: '#ef4444', fontSize: 18, fontWeight: '900', textTransform: 'uppercase', marginBottom: 12 },
  descText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  backBtn: { backgroundColor: '#1e293b', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginTop: 20 },
  backBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }
});
