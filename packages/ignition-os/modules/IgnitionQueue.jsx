/**
 * FILE: IgnitionQueue.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Displays a scrollable list of active service jobs and their statuses, allowing technicians to interact with them.
 * DEPENDENCIES: react, react-native, lucide-react-native, expo-haptics
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Play, Tag, Car } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function IgnitionQueue({ jobs, onSelectJob }) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>LIVE SERVICE QUEUE ({jobs.length})</Text>
      <ScrollView>
        {jobs.map((job, index) => (
          <View key={index} style={styles.jobCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.jobId}>{job.jobId}</Text>
                <Text style={styles.customerName}>{job.name || 'UNKNOWN'}</Text>
              </View>
              <View style={styles.tagBadge}>
                <Tag color="#3b82f6" size={12} />
                <Text style={styles.tagText}>{job.keyTag || 'NO TAG'}</Text>
              </View>
            </View>
            
            <View style={styles.vehicleRow}>
                <Car color="#94a3b8" size={14} />
                <Text style={styles.vehicleText}>{job.year} {job.make} {job.model}</Text>
            </View>

            <Text style={styles.issueText}>{job.description || 'No description provided.'}</Text>

            <TouchableOpacity 
              style={[styles.actionBtn, job.status === 'NEEDS_ESTIMATE' && { backgroundColor: '#10b981' }]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                onSelectJob(job);
              }}
            >
              <Text style={styles.btnText}>{job.status === 'NEEDS_ESTIMATE' ? 'BUILD ESTIMATE' : 'START EVALUATION'}</Text>
              <Play color="#fff" size={16} fill="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionLabel: { color: '#475569', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 15 },
  jobCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#1e293b' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  jobId: { color: '#3b82f6', fontSize: 12, fontWeight: '900' },
  customerName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  tagBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginLeft: 5 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  vehicleText: { color: '#94a3b8', fontSize: 12, marginLeft: 8, fontWeight: 'bold' },
  issueText: { color: '#94a3b8', fontSize: 13, marginBottom: 20 },
  actionBtn: { backgroundColor: '#2563eb', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: 'bold', marginRight: 10, fontSize: 12 }
});