/**
 * FILE: EnrollmentCatch.native.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Security and liability onboarding agreement screen for mobile technicians.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';

const EnrollmentCatch = ({ profile, onComplete }) => {
  const [hasScrolled, setHasScrolled] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Ignition OS</Text>
      <Text style={styles.subtitle}>SECURITY & LIABILITY ONBOARDING</Text>

      <ScrollView 
        style={styles.scrollBox}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
            setHasScrolled(true);
          }
        }}
        scrollEventThrottle={16}
      >
        <Text style={styles.sectionTitle}>Section 1: Personal Tool Ownership</Text>
        <Text style={styles.paragraph}>I acknowledge that I am solely responsible for the maintenance, security, and tracking of my personal toolset. The shop is not liable for loss or damage to personal assets.</Text>
        
        <Text style={styles.sectionTitle}>Section 2: Shop Asset Custody</Text>
        <Text style={styles.paragraph}>I agree that any shop-owned hardware (scanners, jacks, specialty tools) assigned to my bay or checked out via my ID is my responsibility. I will report missing items immediately via the Investigation Log.</Text>
        <View style={{ height: 20 }} />
      </ScrollView>

      <TouchableOpacity 
        disabled={!hasScrolled}
        style={[styles.acceptBtn, hasScrolled ? styles.btnActive : styles.btnDisabled]}
        onPress={onComplete}
      >
        <Text style={[styles.btnText, !hasScrolled && { color: '#475569' }]}>
          {hasScrolled ? 'ACCEPT & ENTER SHOP' : 'SCROLL TO BOTTOM TO ACCEPT'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', fontStyle: 'italic', textAlign: 'center', marginBottom: 5 },
  subtitle: { color: '#3b82f6', fontSize: 10, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 20 },
  scrollBox: { flex: 1, backgroundColor: '#0f172a', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1e293b', marginBottom: 20 },
  sectionTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 10 },
  paragraph: { color: '#94a3b8', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  acceptBtn: { padding: 20, borderRadius: 24, alignItems: 'center' },
  btnActive: { backgroundColor: '#10b981' },
  btnDisabled: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b' },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});

export default EnrollmentCatch;
