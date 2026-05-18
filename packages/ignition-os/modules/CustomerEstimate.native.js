/**
 * FILE: CustomerEstimate.native.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Mobile view for service writers to build quotes at the vehicle.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { FileSignature, AlertCircle, Mic, Wrench, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function CustomerEstimate({ selectedJob, onSendToKiosk }) {
  if (!selectedJob) return null;

  const handleSend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (onSendToKiosk) {
      onSendToKiosk();
    } else {
      alert("Customer kiosk not available from this context.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <FileSignature color="#10b981" size={32} />
        <View style={styles.headerText}>
          <Text style={styles.title}>ESTIMATE BUILDER</Text>
          <Text style={styles.subtitle}>WORK ORDER: {selectedJob.jobId || selectedJob.id}</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* VEHICLE INFO */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ASSET DETAILS</Text>
          <Text style={styles.mainText}>{selectedJob.year} {selectedJob.make} {selectedJob.model}</Text>
          <Text style={styles.subText}>VIN: {selectedJob.vin || 'N/A'}</Text>
        </View>

        {/* CUSTOMER ISSUE */}
        <View style={[styles.card, { borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.05)' }]}>
          <View style={styles.cardHeader}>
            <AlertCircle color="#f59e0b" size={16} />
            <Text style={[styles.sectionLabel, { color: '#f59e0b', marginBottom: 0, marginLeft: 8 }]}>REPORTED ISSUE</Text>
          </View>
          <Text style={styles.mainText}>{selectedJob.complaint || selectedJob.problem || 'No specific problem reported.'}</Text>
        </View>

        {/* TECH EVAL / TRANSCRIPTION */}
        <View style={[styles.card, { borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.05)' }]}>
          <View style={styles.cardHeader}>
            <Mic color="#3b82f6" size={16} />
            <Text style={[styles.sectionLabel, { color: '#3b82f6', marginBottom: 0, marginLeft: 8 }]}>TECH DIAGNOSTIC NOTES</Text>
          </View>
          <Text style={[styles.mainText, { fontStyle: 'italic' }]}>"{selectedJob.transcription || 'No notes provided.'}"</Text>
        </View>

        {/* AI EXTRACTED PARTS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Wrench color="#8b5cf6" size={16} />
            <Text style={[styles.sectionLabel, { color: '#8b5cf6', marginBottom: 0, marginLeft: 8 }]}>REQUIRED PARTS MANIFEST</Text>
          </View>
          {selectedJob.suggestedParts && selectedJob.suggestedParts.length > 0 ? (
            selectedJob.suggestedParts.map((part, idx) => (
              <View key={idx} style={styles.partRow}>
                <Text style={styles.partText}>{part.name}</Text>
                <Text style={styles.partQty}>QTY: {part.qty}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.subText}>No parts extracted.</Text>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
        <Send color="#fff" size={24} />
        <Text style={styles.sendBtnText}>SEND TO CUSTOMER PORTAL</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerText: { marginLeft: 15 },
  title: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#10b981', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 2 },
  scrollArea: { flex: 1 },
  card: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 15 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { color: '#475569', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  mainText: { color: '#f8fafc', fontSize: 15, fontWeight: '600', lineHeight: 22 },
  subText: { color: '#64748b', fontSize: 12, marginTop: 5, fontWeight: 'bold' },
  partRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  partText: { color: '#e2e8f0', fontSize: 14, fontWeight: 'bold' },
  partQty: { color: '#8b5cf6', fontSize: 12, fontWeight: '900' },
  sendBtn: { backgroundColor: '#10b981', flexDirection: 'row', height: 70, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, marginTop: 10 },
  sendBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1, marginLeft: 10 }
});