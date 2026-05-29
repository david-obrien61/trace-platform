/**
 * FILE: TechKeypad.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Renders a numeric PIN-based lock screen/keypad for secure technician authentication.
 * DEPENDENCIES: react, react-native, lucide-react-native, expo-haptics
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { ShieldCheck, Delete } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function TechKeypad({ onUnlock }) {
  const [pin, setPin] = useState('');

  const handlePress = (val) => {
    if (pin.length < 4) {
      const newPin = pin + val;
      setPin(newPin);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Auto-submit when 4 digits are reached
      if (newPin.length === 4) {
        onUnlock(newPin);
        setPin(''); // Reset for next attempt
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ShieldCheck color="#3b82f6" size={32} />
        <Text style={styles.title}>ENTER ACCESS KEY</Text>
        <View style={styles.dotsRow}>
          {[1, 2, 3, 4].map((_, i) => (
            <View 
              key={i} 
              style={[styles.dot, pin.length > i && styles.dotFilled]} 
            />
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((item, index) => {
          if (item === '') return <View key={index} style={styles.key} />;
          if (item === 'del') {
            return (
              <TouchableOpacity key={index} style={styles.key} onPress={handleDelete}>
                <Delete color="#ef4444" size={24} />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity 
              key={index} 
              style={styles.key} 
              onPress={() => handlePress(item)}
            >
              <Text style={styles.keyText}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { color: '#f8fafc', fontWeight: '900', marginTop: 15, letterSpacing: 2, fontSize: 12 },
  dotsRow: { flexDirection: 'row', marginTop: 20 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: '#1e293b', marginHorizontal: 10 },
  dotFilled: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: width * 0.8, justifyContent: 'center' },
  key: { width: width * 0.2, height: width * 0.2, justifyContent: 'center', alignItems: 'center', margin: 10, backgroundColor: '#0f172a', borderRadius: width * 0.1, borderWidth: 1, borderColor: '#1e293b' },
  keyText: { color: '#fff', fontSize: 24, fontWeight: 'bold' }
});