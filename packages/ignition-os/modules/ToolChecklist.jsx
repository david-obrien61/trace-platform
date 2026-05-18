/**
 * FILE: ToolChecklist.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Checkbox component tracking hardware accountability for technicians prior to job conclusion.
 * DEPENDENCIES: react, react-native, lucide-react-native, expo-haptics
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Wrench, CheckSquare, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function ToolChecklist({ onValidationChange }) {
  const [tools, setTools] = useState([
    { id: 1, name: 'Scanner/Tablet', checked: false },
    { id: 2, name: 'Torque Wrench', checked: false },
    { id: 3, name: 'Shop Light', checked: false },
  ]);

  const toggleTool = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newTools = tools.map(t => 
      t.id === id ? { ...t, checked: !t.checked } : t
    );
    setTools(newTools);
    
    // Check if everything is accounted for
    const allChecked = newTools.every(t => t.checked);
    onValidationChange(allChecked);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Wrench color="#94a3b8" size={16} />
        <Text style={styles.title}>HARDWARE ACCOUNTABILITY</Text>
      </View>
      
      {tools.map(tool => (
        <TouchableOpacity 
          key={tool.id} 
          style={styles.item} 
          onPress={() => toggleTool(tool.id)}
        >
          {tool.checked ? (
            <CheckSquare color="#10b981" size={20} />
          ) : (
            <Square color="#475569" size={20} />
          )}
          <Text style={[styles.itemText, tool.checked && styles.checkedText]}>
            {tool.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0f172a', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', marginTop: 15 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { color: '#94a3b8', fontSize: 10, fontWeight: '900', marginLeft: 8, letterSpacing: 1 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  itemText: { color: '#f8fafc', fontSize: 14, fontWeight: '600', marginLeft: 12 },
  checkedText: { color: '#64748b', textDecorationLine: 'line-through' }
});