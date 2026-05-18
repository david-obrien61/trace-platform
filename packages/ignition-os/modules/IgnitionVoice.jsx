/**
 * FILE: IgnitionVoice.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Handles voice recordings, submits them to a local AI transcriber API, and displays extracted parts manifests.
 * DEPENDENCIES: react, react-native, lucide-react-native, expo-haptics, expo-audio
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Mic, Square, ShieldCheck, AlertCircle, Car, Activity, CheckCircle2, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';

export default function IgnitionVoice({ selectedJob, onApprove }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [suggestedParts, setSuggestedParts] = useState([]);
  const [suggestedTasks, setSuggestedTasks] = useState([]);
  const [isApproved, setIsApproved] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const toggleRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (isRecording) {
      // Stop Recording
      setIsRecording(false);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      console.log('Recording saved successfully at:', uri);
      
      setIsParsing(true);

      try {
        const formData = new FormData();
        formData.append('file', { uri, type: 'audio/m4a', name: 'diagnostic.m4a' });

        const apiUrl = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || process.env?.EXPO_PUBLIC_API_URL || 'http://localhost:8000') + '/transcribe';
        const response = await fetch(apiUrl, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Backend Error:", errorText);
          alert("Transcription Failed: Check your Python terminal for errors.");
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        setTranscription(data.transcription);
        
        // Extract flat list of parts from tasks, and keep the tasks array
        const extractedParts = data.tasks ? data.tasks.flatMap(t => t.parts || []) : [];
        setSuggestedParts(extractedParts);
        setSuggestedTasks(data.tasks || []);
      } catch (err) {
        console.error("Transcription error: ", err);
      } finally {
        setIsParsing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      // Start Recording
      try {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) {
          alert('Microphone permission is required to record diagnostics.');
          return;
        }
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start recording', err);
      }
    }
  };

  const handleApprove = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsApproved(true);
    // Pass the extracted data up to App.js to update the job record
    setTimeout(() => onApprove(transcription, suggestedParts, suggestedTasks), 1000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.vHeader}>
        <View style={styles.headerInfo}>
          <View style={styles.badge}>
            <ShieldCheck color="#10b981" size={12} />
            <Text style={styles.badgeText}>VERIFIED DATA BRIDGE ACTIVE</Text>
          </View>
          <Text style={styles.vehicleText}>
            {`${selectedJob?.year || '????'} ${selectedJob?.make || 'Unknown'} ${selectedJob?.model || 'Vehicle'}`.toUpperCase()}
          </Text>
          <Text style={styles.vinText}>VIN: {selectedJob?.vin || 'NOT REGISTERED'}</Text>
        </View>
        <Car color="#1e293b" size={40} />
      </View>

      <View style={styles.complaintBox}>
        <View style={styles.complaintHeader}>
          <AlertCircle color="#f59e0b" size={14} />
          <Text style={styles.complaintLabel}>CUSTOMER STATED PROBLEM</Text>
        </View>
        <Text style={styles.complaintText}>
          {selectedJob?.problem || "No specific problem provided during intake."}
        </Text>
      </View>

      <ScrollView style={styles.notesArea} showsVerticalScrollIndicator={false}>
        <Text style={styles.notesLabel}>READY FOR TEARDOWN NOTES</Text>
        <View style={styles.notesContainer}>
          {isRecording ? (
            <View style={styles.recordingState}>
              <Activity color="#ef4444" size="small" />
              <Text style={styles.listeningText}>LISTENING TO TECHNICIAN...</Text>
            </View>
          ) : isParsing ? (
            <View style={styles.recordingState}>
              <ActivityIndicator color="#3b82f6" size="small" />
              <Text style={[styles.listeningText, {color: '#3b82f6'}]}>TRANSCRIBING & EXTRACTING AI MANIFEST...</Text>
            </View>
          ) : transcription ? (
            <View>
              <Text style={styles.transcriptionText}>"{transcription}"</Text>
              <View style={styles.partsDivider} />
              <Text style={styles.partsHeader}>AI EXTRACTED PARTS MANIFEST:</Text>
              {suggestedParts.map((part) => (
                <View key={part.id} style={styles.partItem}>
                  <View style={styles.partDot} />
                  <Text style={styles.partName}>{part.name} (x{part.qty})</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.placeholderText}>Awaiting technician voice input diagnostic notes...</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!transcription ? (
          <TouchableOpacity 
            style={[styles.diagBtn, isRecording && styles.recordingBtn]} 
            onPress={toggleRecording}
          >
            {isRecording ? <Square color="#fff" size={24} /> : <Mic color="#fff" size={24} />}
            <Text style={styles.diagBtnText}>
              {isRecording ? "STOP & TRANSCRIBE" : "START DIAGNOSTIC"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.diagBtn, isApproved ? {backgroundColor: '#10b981'} : {backgroundColor: '#8b5cf6'}]} 
            onPress={handleApprove}
            disabled={isApproved}
          >
            {isApproved ? <CheckCircle2 color="#fff" size={24} /> : <Send color="#fff" size={24} />}
            <Text style={styles.diagBtnText}>
              {isApproved ? "SENT TO FRONT DESK" : "APPROVE & SEND ESTIMATE"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  vHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#1e293b', marginBottom: 15 },
  headerInfo: { flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  badgeText: { color: '#10b981', fontSize: 9, fontWeight: '900', marginLeft: 5, letterSpacing: 1 },
  vehicleText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  vinText: { color: '#475569', fontSize: 11, fontWeight: 'bold', marginTop: 4 },
  complaintBox: { backgroundColor: 'rgba(245, 158, 11, 0.05)', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)' },
  complaintHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  complaintLabel: { color: '#f59e0b', fontSize: 9, fontWeight: '900', marginLeft: 8 },
  complaintText: { color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 22 },
  notesArea: { flex: 1, marginTop: 20 },
  notesLabel: { color: '#475569', fontSize: 10, fontWeight: '900', marginBottom: 10, letterSpacing: 1 },
  notesContainer: { flex: 1, backgroundColor: '#0f172a', borderRadius: 28, padding: 25, borderWidth: 1, borderColor: '#1e293b' },
  placeholderText: { color: '#334155', fontStyle: 'italic', fontSize: 15 },
  recordingState: { flexDirection: 'row', alignItems: 'center' },
  listeningText: { color: '#ef4444', fontWeight: '900', fontSize: 12, marginLeft: 10, letterSpacing: 1 },
  transcriptionText: { color: '#fff', fontSize: 15, fontStyle: 'italic', lineHeight: 24 },
  partsDivider: { height: 1, backgroundColor: '#1e293b', marginVertical: 15 },
  partsHeader: { color: '#3b82f6', fontSize: 10, fontWeight: '900', marginBottom: 10, letterSpacing: 1 },
  partItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  partDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 10 },
  partName: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  footer: { paddingBottom: 20, paddingTop: 10 },
  diagBtn: { backgroundColor: '#3b82f6', height: 80, borderRadius: 28, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  recordingBtn: { backgroundColor: '#ef4444' },
  diagBtnText: { color: '#fff', fontWeight: '900', marginLeft: 15, fontSize: 18, letterSpacing: 1 }
});