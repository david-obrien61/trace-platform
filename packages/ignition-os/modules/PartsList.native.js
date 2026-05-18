/**
 * FILE: PartsList.native.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: UI for technicians to view and explore pinned preferences and part specifications via a Modal Data Explorer.
 * DEPENDENCIES: react, react-native, lucide-react-native, expo-haptics
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Database, Activity, X, Pin, PinOff, ChevronLeft, ChevronRight, Mic } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function PartsList({ selectedJob, profile, onUpdatePrefs }) {
  const [showSpecs, setShowSpecs] = useState(false);
  const [page, setPage] = useState(0);

  const togglePin = (v) => {
    const cur = profile?.preferences?.pinnedSpecs || [];
    const next = cur.includes(v) ? cur.filter(k => k !== v) : [...cur, v];
    onUpdatePrefs(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const specs = selectedJob?.allSpecs || [];
  const paged = specs.slice(page * 30, (page + 1) * 30);

  return (
    <View style={styles.container}>
      {/* HEADER BUTTON */}
      <TouchableOpacity 
        style={styles.header} 
        activeOpacity={0.8}
        onPress={() => {
            setShowSpecs(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
      >
        <Text style={styles.jobId}>{selectedJob?.jobId}</Text>
        <Text style={styles.title}>{selectedJob?.year} {selectedJob?.make} {selectedJob?.model}</Text>
        <View style={styles.metaRow}>
          <Database color="#3b82f6" size={12} /><Text style={styles.metaText}>{selectedJob?.vin}</Text>
          <Activity color="#3b82f6" size={12} style={{marginLeft: 15}} /><Text style={styles.metaText}>{selectedJob?.engine}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.micBtn}>
        <Mic color="#fff" size={32} />
        <Text style={styles.micText}>RECORD PARTS LIST</Text>
      </TouchableOpacity>

      {/* FIXED MODAL NAVIGATION */}
      <Modal 
        visible={showSpecs} 
        animationType="slide" 
        presentationStyle="fullScreen"
        onRequestClose={() => setShowSpecs(false)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
                <Text style={styles.modalTitle}>TECH DATA EXPLORER</Text>
                <Text style={styles.modalSub}>{selectedJob?.vin}</Text>
            </View>
            <TouchableOpacity 
                style={styles.closeAction} 
                onPress={() => setShowSpecs(false)}
            >
              <X color="#fff" size={28} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{flex: 1, padding: 20}}>
            <Text style={styles.sectionLabel}>PINNED PREFERENCES</Text>
            <View style={styles.grid}>
              {specs.filter(s => profile?.preferences?.pinnedSpecs?.includes(s.Variable)).map((s, i) => (
                <View key={i} style={styles.pinCard}>
                  <View style={styles.row}>
                    <Text style={styles.pinLabel}>{s.Variable.toUpperCase()}</Text>
                    <TouchableOpacity onPress={() => togglePin(s.Variable)}>
                        <PinOff color="#3b82f6" size={12} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.pinVal}>{s.Value}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionLabel}>ALL DATA (PAGE {page + 1})</Text>
            {paged.length > 0 ? paged.map((s, i) => (
              <View key={i} style={styles.specRow}>
                <View style={{flex: 1}}>
                    <Text style={styles.specLabel}>{s.Variable.toUpperCase()}</Text>
                    <Text style={styles.specValText}>{s.Value}</Text>
                </View>
                <TouchableOpacity onPress={() => togglePin(s.Variable)}>
                    <Pin 
                        color={profile?.preferences?.pinnedSpecs?.includes(s.Variable) ? "#3b82f6" : "#1e293b"} 
                        size={20} 
                        fill={profile?.preferences?.pinnedSpecs?.includes(s.Variable) ? "#3b82f6" : "transparent"} 
                    />
                </TouchableOpacity>
              </View>
            )) : <Text style={styles.emptyText}>No additional data found.</Text>}

            <View style={styles.pager}>
                <TouchableOpacity onPress={() => setPage(Math.max(0, page - 1))}><ChevronLeft color="#3b82f6" size={32}/></TouchableOpacity>
                <Text style={styles.pageIndicator}>{page + 1}</Text>
                <TouchableOpacity onPress={() => setPage(page + 1)}><ChevronRight color="#3b82f6" size={32}/></TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { backgroundColor: '#0f172a', padding: 20, borderRadius: 15, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  jobId: { color: '#3b82f6', fontSize: 10, fontWeight: 'bold' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  metaText: { color: '#94a3b8', fontSize: 11, marginLeft: 5 },
  micBtn: { backgroundColor: '#3b82f6', padding: 30, borderRadius: 20, alignItems: 'center', marginTop: 20 },
  micText: { color: '#fff', fontWeight: 'bold', marginTop: 10 },
  modal: { flex: 1, backgroundColor: '#020617' },
  modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  modalTitle: { color: '#fff', fontWeight: '900', fontSize: 16 },
  modalSub: { color: '#475569', fontSize: 10, fontWeight: 'bold', marginTop: 4 },
  closeAction: { padding: 10, backgroundColor: '#0f172a', borderRadius: 12 },
  sectionLabel: { color: '#3b82f6', fontSize: 10, fontWeight: 'bold', marginVertical: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  pinCard: { backgroundColor: '#0f172a', width: '48%', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  pinLabel: { color: '#475569', fontSize: 7, fontWeight: 'bold' },
  pinVal: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  specRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  specLabel: { color: '#475569', fontSize: 8, fontWeight: 'bold' },
  specValText: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold', marginTop: 2 },
  emptyText: { color: '#334155', textAlign: 'center', marginTop: 40 },
  pager: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 40 },
  pageIndicator: { color: '#fff', marginHorizontal: 30, fontSize: 18, fontWeight: 'bold' }
});