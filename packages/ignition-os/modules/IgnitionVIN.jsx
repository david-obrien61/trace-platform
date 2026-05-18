/**
 * FILE: IgnitionVIN.jsx
 * PLATFORM: Mobile (React Native)
 * PURPOSE: VIN validation via barcode scan, camera-assisted manual entry, or direct
 *          manual input. Decodes via NHTSA vPIC API (free, no key required).
 */

import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Image
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Scan, ShieldCheck, ChevronRight, CheckCircle2, XCircle,
  Camera, AlertCircle, RefreshCw, Cpu
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

// ML Kit text recognition — available after Dev Client build with
// @react-native-ml-kit/text-recognition installed.
// Falls back gracefully when the package is not present (Expo Go).
let TextRecognition = null;
try {
  TextRecognition = require('@react-native-ml-kit/text-recognition').default;
} catch (_) {
  // Running in Expo Go — OCR will use camera-assist fallback instead
}
const ML_KIT_AVAILABLE = TextRecognition !== null;

// ─── NHTSA API ────────────────────────────────────────────────────────────────

const NHTSA_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues';

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

const decodeViaNHTSA = async (vin) => {
  const clean = vin.trim().toUpperCase();
  if (!VIN_REGEX.test(clean)) {
    throw new Error(`Invalid VIN format. Must be 17 characters, no I, O, or Q.\nEntered: "${clean}" (${clean.length} chars)`);
  }

  const res = await fetch(`${NHTSA_URL}/${clean}?format=json`);
  if (!res.ok) throw new Error('NHTSA API unreachable. Check network connection.');

  const json = await res.json();
  const r = json?.Results?.[0];
  if (!r || r.ErrorCode !== '0') {
    const msg = r?.AdditionalErrorText || r?.ErrorText || 'VIN not found in NHTSA database.';
    throw new Error(msg);
  }

  const displacement = parseFloat(r.DisplacementL);
  const cylinders    = r.EngineCylinders ? `${r.EngineCylinders}-cyl` : '';
  const hp           = r.EngineHP        ? `${r.EngineHP}hp`          : '';
  const fuel         = r.FuelTypePrimary || '';
  const engineParts  = [
    displacement ? `${displacement.toFixed(1)}L` : '',
    cylinders,
    hp,
    fuel,
  ].filter(Boolean).join(' ');

  return {
    vin:          clean,
    year:         r.ModelYear       || '',
    make:         r.Make            || '',
    model:        r.Model           || '',
    trim:         r.Trim            || '',
    engine:       engineParts       || 'Engine data unavailable',
    bodyClass:    r.BodyClass       || '',
    driveType:    r.DriveType       || '',
    fuelType:     r.FuelTypePrimary || '',
    transmission: r.TransmissionStyle || '',
    plantCountry: r.PlantCountry   || '',
    isValidated:  true,
  };
};

// ─── BARCODE SCANNER ─────────────────────────────────────────────────────────

// VIN stickers use PDF417. Door jam barcodes also appear as Code128.
const VIN_BARCODE_TYPES = ['pdf417', 'code128', 'code39', 'datamatrix', 'qr'];

const BarcodeScanner = ({ onScanned, onClose }) => (
  <View style={styles.cameraContainer}>
    <CameraView
      style={StyleSheet.absoluteFillObject}
      onBarcodeScanned={onScanned}
      barcodeScannerSettings={{ barcodeTypes: VIN_BARCODE_TYPES }}
    />
    <View style={styles.scanOverlay}>
      <View style={styles.scanFrame} />
      <Text style={styles.scanHint}>Align VIN barcode within the frame</Text>
      <Text style={styles.scanHintSub}>Door sticker · Dashboard · Title</Text>
    </View>
    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
      <XCircle color="#fff" size={32} />
    </TouchableOpacity>
  </View>
);

// ─── OCR / PHOTO ASSIST CAMERA ───────────────────────────────────────────────

const PhotoAssist = ({ onPhotoTaken, onOCRResult, onClose }) => {
  const cameraRef   = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const [scanning,  setScanning]  = useState(false);

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: false });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (ML_KIT_AVAILABLE) {
        // Real OCR path — extract VIN from photo automatically
        setScanning(true);
        try {
          const result  = await TextRecognition.recognize(photo.uri);
          const allText = result.blocks.map(b => b.text).join(' ').toUpperCase().replace(/\s/g, '');
          const match   = allText.match(/[A-HJ-NPR-Z0-9]{17}/);
          if (match) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onOCRResult(match[0], photo.uri);   // VIN found — auto-populate
          } else {
            // Text found but no valid VIN pattern — fall through to manual confirm
            onPhotoTaken(photo.uri);
          }
        } catch (err) {
          onPhotoTaken(photo.uri);              // OCR failed — show photo for manual entry
        }
      } else {
        // Expo Go fallback — show photo, tech reads and types VIN
        onPhotoTaken(photo.uri);
      }
    } catch (e) {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.cameraContainer}>
      <CameraView style={StyleSheet.absoluteFillObject} ref={cameraRef} />
      <View style={styles.photoOverlay}>
        <Text style={styles.scanHint}>
          {ML_KIT_AVAILABLE ? 'Frame VIN — AI reads automatically' : 'Frame the VIN plate or sticker'}
        </Text>
        <Text style={styles.scanHintSub}>
          {ML_KIT_AVAILABLE ? 'On-device · No internet required' : 'You will confirm the VIN after capture'}
        </Text>
        <TouchableOpacity style={styles.captureBtn} onPress={capture} disabled={capturing || scanning}>
          {capturing || scanning
            ? <ActivityIndicator color="#fff" />
            : <View style={styles.captureBtnInner} />
          }
        </TouchableOpacity>
        {scanning && <Text style={styles.scanningLabel}>READING VIN...</Text>}
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <XCircle color="#fff" size={32} />
      </TouchableOpacity>
    </View>
  );
};

// ─── VALIDATION ROW ───────────────────────────────────────────────────────────

const ValidationRow = ({ label, intake, verified, onChange }) => {
  const isMatch = String(intake || '').trim().toLowerCase() === String(verified || '').trim().toLowerCase();
  const empty   = !intake && !verified;

  return (
    <View style={styles.valRow}>
      <View style={styles.valCol}>
        <Text style={styles.valLabel}>INTAKE {label}</Text>
        <Text style={[styles.valValue, !intake && { color: '#475569', fontStyle: 'italic' }]}>
          {intake || 'not captured'}
        </Text>
      </View>
      <ChevronRight color="#1e293b" size={16} />
      <View style={styles.valCol}>
        <Text style={styles.valLabel}>VERIFIED {label}</Text>
        <TextInput
          style={[styles.valInput, !isMatch && !empty && { color: '#ef4444' }]}
          value={verified}
          onChangeText={onChange}
        />
      </View>
      {empty
        ? null
        : !isMatch
          ? <XCircle color="#ef4444" size={20} />
          : <CheckCircle2 color="#10b981" size={20} />
      }
    </View>
  );
};

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

export default function IgnitionVIN({ jobData, onComplete }) {
  const [permission, requestPermission] = useCameraPermissions();

  // view: 'selection' | 'scanner' | 'photo' | 'photoConfirm' | 'loading' | 'validation' | 'error'
  const [view,            setView]            = useState('selection');
  const [manualVin,       setManualVin]       = useState(jobData?.vin || '');
  const [decodedResult,   setDecodedResult]   = useState(null);
  const [photoUri,        setPhotoUri]        = useState(null);
  const [errorMsg,        setErrorMsg]        = useState('');

  const requestAndOpen = async (target) => {
    if (permission?.granted) {
      setView(target);
    } else {
      const { granted } = await requestPermission();
      if (granted) setView(target);
    }
  };

  const runDecode = async (vin) => {
    setView('loading');
    setErrorMsg('');
    try {
      const result = await decodeViaNHTSA(vin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDecodedResult(result);
      setView('validation');
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg(err.message);
      setView('error');
    }
  };

  const onBarcodeScanned = ({ data }) => {
    runDecode(data);
  };

  // ── BARCODE SCANNER ──────────────────────────────────────────────────────
  if (view === 'scanner') {
    return <BarcodeScanner onScanned={onBarcodeScanned} onClose={() => setView('selection')} />;
  }

  // ── PHOTO / OCR CAPTURE ──────────────────────────────────────────────────
  if (view === 'photo') {
    return (
      <PhotoAssist
        onPhotoTaken={(uri) => { setPhotoUri(uri); setView('photoConfirm'); }}
        onOCRResult={(vin, uri) => {
          // ML Kit found a VIN — skip manual confirm, go straight to NHTSA decode
          setManualVin(vin);
          setPhotoUri(uri);
          runDecode(vin);
        }}
        onClose={() => setView('selection')}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.versionTag}>VIN.CoreApp.002 // NHTSA</Text>
        <Text style={styles.title}>IDENTITY VALIDATION</Text>
        <Text style={styles.subtitle}>
          {jobData?.jobId ? `JOB: ${jobData.jobId} // ${jobData?.name || ''}` : 'CHASSIS DECODE'}
        </Text>
      </View>

      {/* ── SELECTION ── */}
      {view === 'selection' && (
        <ScrollView contentContainerStyle={styles.menu} showsVerticalScrollIndicator={false}>

          {/* BARCODE */}
          <TouchableOpacity
            style={styles.scanBtnMain}
            onPress={() => requestAndOpen('scanner')}
          >
            <Scan color="#3b82f6" size={48} />
            <Text style={styles.scanBtnText}>SCAN VIN BARCODE</Text>
            <Text style={styles.scanBtnSub}>PDF417 · Code128 · Door sticker</Text>
          </TouchableOpacity>

          {/* PHOTO / OCR */}
          <TouchableOpacity
            style={[styles.ocrBtn, ML_KIT_AVAILABLE && { borderColor: '#7c3aed' }]}
            onPress={() => requestAndOpen('photo')}
          >
            <Camera color={ML_KIT_AVAILABLE ? '#7c3aed' : '#475569'} size={24} />
            <View style={{ marginLeft: 15, flex: 1 }}>
              <Text style={[styles.ocrBtnText, ML_KIT_AVAILABLE && { color: '#a78bfa' }]}>
                {ML_KIT_AVAILABLE ? 'SCAN VIN TEXT (AI READ)' : 'CAMERA ASSIST'}
              </Text>
              <Text style={styles.ocrBtnSub}>
                {ML_KIT_AVAILABLE
                  ? 'Point at VIN plate — extracted automatically · On-device'
                  : 'Photograph VIN plate — enter manually from photo'}
              </Text>
            </View>
            {ML_KIT_AVAILABLE && (
              <View style={styles.mlBadge}>
                <Text style={styles.mlBadgeText}>ML</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* MANUAL */}
          <View style={styles.manualBox}>
            <Text style={styles.inputLabel}>MANUAL CHASSIS ENTRY</Text>
            <TextInput
              style={styles.vinInput}
              value={manualVin}
              onChangeText={setManualVin}
              placeholder="1HGCM82633A004352"
              placeholderTextColor="#334155"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={17}
            />
            <View style={styles.vinMeta}>
              <Text style={[
                styles.vinCount,
                manualVin.length === 17 ? { color: '#10b981' } : manualVin.length > 0 ? { color: '#f59e0b' } : {}
              ]}>
                {manualVin.length}/17
              </Text>
              {manualVin.length === 17 && VIN_REGEX.test(manualVin) && (
                <CheckCircle2 color="#10b981" size={16} />
              )}
            </View>
            <TouchableOpacity
              style={[styles.valBtn, manualVin.length !== 17 && styles.valBtnDisabled]}
              onPress={() => runDecode(manualVin)}
              disabled={manualVin.length !== 17}
            >
              <Text style={styles.valBtnText}>VALIDATE CHASSIS</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}

      {/* ── PHOTO CONFIRM ── */}
      {view === 'photoConfirm' && photoUri && (
        <ScrollView contentContainerStyle={{ gap: 16, paddingTop: 10 }}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="contain" />
          <Text style={styles.photoHint}>Read the VIN from the photo and enter it below</Text>
          <View style={styles.manualBox}>
            <Text style={styles.inputLabel}>VIN FROM PHOTO</Text>
            <TextInput
              style={styles.vinInput}
              value={manualVin}
              onChangeText={setManualVin}
              placeholder="Type VIN you see above..."
              placeholderTextColor="#334155"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={17}
            />
            <View style={styles.vinMeta}>
              <Text style={[styles.vinCount, manualVin.length === 17 ? { color: '#10b981' } : { color: '#f59e0b' }]}>
                {manualVin.length}/17
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.valBtn, { flex: 1, backgroundColor: '#1e293b' }]} onPress={() => setView('photo')}>
                <Text style={styles.valBtnText}>RETAKE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.valBtn, { flex: 2 }, manualVin.length !== 17 && styles.valBtnDisabled]}
                onPress={() => runDecode(manualVin)}
                disabled={manualVin.length !== 17}
              >
                <Text style={styles.valBtnText}>VALIDATE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* ── LOADING ── */}
      {view === 'loading' && (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>QUERYING NHTSA DATABASE...</Text>
          <Text style={styles.loadingSub}>{manualVin.toUpperCase()}</Text>
        </View>
      )}

      {/* ── ERROR ── */}
      {view === 'error' && (
        <View style={styles.centerState}>
          <AlertCircle color="#ef4444" size={48} />
          <Text style={styles.errorTitle}>DECODE FAILED</Text>
          <Text style={styles.errorMsg}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => setView('selection')}>
            <RefreshCw color="#fff" size={16} />
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── VALIDATION ── */}
      {view === 'validation' && decodedResult && (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>DATA CROSS-REFERENCE — INTAKE vs. NHTSA VERIFIED</Text>

          <ValidationRow
            label="YEAR"
            intake={jobData?.year}
            verified={decodedResult.year}
            onChange={v => setDecodedResult(r => ({ ...r, year: v }))}
          />
          <ValidationRow
            label="MAKE"
            intake={jobData?.make}
            verified={decodedResult.make}
            onChange={v => setDecodedResult(r => ({ ...r, make: v }))}
          />
          <ValidationRow
            label="MODEL"
            intake={jobData?.model}
            verified={decodedResult.model}
            onChange={v => setDecodedResult(r => ({ ...r, model: v }))}
          />

          {/* POWERTRAIN */}
          <View style={styles.engineCard}>
            <View style={styles.cardHeader}>
              <Cpu color="#3b82f6" size={16} />
              <Text style={styles.cardTitle}>POWERTRAIN DATA // NHTSA</Text>
            </View>
            <Text style={styles.engineText}>{decodedResult.engine}</Text>
            {decodedResult.trim ? <Text style={styles.specText}>Trim: {decodedResult.trim}</Text> : null}
            {decodedResult.driveType ? <Text style={styles.specText}>Drive: {decodedResult.driveType}</Text> : null}
            {decodedResult.bodyClass ? <Text style={styles.specText}>Body: {decodedResult.bodyClass}</Text> : null}
            <Text style={styles.vinText}>VIN: {decodedResult.vin}</Text>
          </View>

          {/* RE-DECODE */}
          <TouchableOpacity style={styles.reDecodeBtn} onPress={() => setView('selection')}>
            <RefreshCw color="#94a3b8" size={14} />
            <Text style={styles.reDecodeText}>Wrong VIN? Scan Again</Text>
          </TouchableOpacity>

          {/* CONFIRM */}
          <TouchableOpacity style={styles.commitBtn} onPress={() => onComplete(decodedResult)}>
            <ShieldCheck color="#fff" size={20} />
            <Text style={styles.commitText}>CONFIRM IDENTITY</Text>
          </TouchableOpacity>
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#020617', padding: 20 },
  header:          { marginBottom: 20 },
  versionTag:      { color: '#1e293b', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title:           { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitle:        { color: '#3b82f6', fontSize: 10, fontWeight: 'bold' },

  // Menu
  menu:            { gap: 16, paddingTop: 10, paddingBottom: 40 },
  scanBtnMain:     { backgroundColor: '#0f172a', padding: 44, borderRadius: 32, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
  scanBtnText:     { color: '#fff', fontWeight: '900', marginTop: 16, fontSize: 14, letterSpacing: 1 },
  scanBtnSub:      { color: '#475569', fontWeight: 'bold', fontSize: 10, marginTop: 6, letterSpacing: 1 },
  ocrBtn:          { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b' },
  ocrBtnText:      { color: '#94a3b8', fontWeight: '900', fontSize: 12 },
  ocrBtnSub:       { color: '#475569', fontWeight: 'bold', fontSize: 10, marginTop: 3 },

  // Manual entry
  manualBox:       { backgroundColor: '#0f172a', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: '#1e293b' },
  inputLabel:      { color: '#475569', fontSize: 9, fontWeight: '900', marginBottom: 12, letterSpacing: 1 },
  vinInput:        { backgroundColor: '#020617', height: 60, borderRadius: 16, paddingHorizontal: 20, color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 3, marginBottom: 8 },
  vinMeta:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  vinCount:        { color: '#475569', fontSize: 11, fontWeight: '900', fontFamily: 'monospace' },
  valBtn:          { backgroundColor: '#3b82f6', padding: 18, borderRadius: 12, alignItems: 'center' },
  valBtnDisabled:  { backgroundColor: '#1e293b', opacity: 0.5 },
  valBtnText:      { color: '#fff', fontWeight: '900', letterSpacing: 1 },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  closeBtn:        { position: 'absolute', top: 60, right: 20 },
  scanOverlay:     { position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' },
  scanFrame:       { width: 280, height: 100, borderWidth: 2, borderColor: '#3b82f6', borderRadius: 8, marginBottom: 20 },
  scanHint:        { color: '#fff', fontWeight: '900', fontSize: 13, textAlign: 'center' },
  scanHintSub:     { color: '#94a3b8', fontWeight: 'bold', fontSize: 10, marginTop: 6, textAlign: 'center' },
  photoOverlay:    { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', gap: 12 },
  captureBtn:      { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 3, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' },

  // Photo confirm
  photoPreview:    { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#0f172a' },
  photoHint:       { color: '#94a3b8', fontWeight: 'bold', fontSize: 11, textAlign: 'center', letterSpacing: 0.5 },

  // Loading / Error
  centerState:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 30 },
  loadingText:     { color: '#94a3b8', fontWeight: '900', fontSize: 12, letterSpacing: 2, marginTop: 10 },
  loadingSub:      { color: '#3b82f6', fontWeight: 'bold', fontFamily: 'monospace', fontSize: 14, letterSpacing: 3 },
  errorTitle:      { color: '#ef4444', fontWeight: '900', fontSize: 18, marginTop: 10 },
  errorMsg:        { color: '#94a3b8', textAlign: 'center', fontSize: 12, lineHeight: 20 },
  retryBtn:        { flexDirection: 'row', gap: 8, backgroundColor: '#1e293b', paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  retryText:       { color: '#fff', fontWeight: '900', letterSpacing: 1 },

  // Validation results
  sectionTitle:    { color: '#475569', fontSize: 10, fontWeight: '900', marginBottom: 16, letterSpacing: 1 },
  valRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 16, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b' },
  valCol:          { flex: 1 },
  valLabel:        { color: '#475569', fontSize: 8, fontWeight: '900', marginBottom: 4, letterSpacing: 1 },
  valValue:        { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  valInput:        { fontSize: 15, fontWeight: 'bold', padding: 0, color: '#3b82f6' },
  engineCard:      { backgroundColor: '#0f172a', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#1e293b', marginVertical: 10 },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle:       { color: '#3b82f6', fontSize: 10, fontWeight: '900', marginLeft: 10, letterSpacing: 1 },
  engineText:      { color: '#fff', fontSize: 18, fontWeight: '900' },
  specText:        { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginTop: 4 },
  vinText:         { color: '#475569', fontSize: 11, fontWeight: 'bold', marginTop: 8, fontFamily: 'monospace', letterSpacing: 1 },
  reDecodeBtn:     { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  reDecodeText:    { color: '#475569', fontWeight: 'bold', fontSize: 12 },
  scanningLabel:   { color: '#a78bfa', fontWeight: '900', fontSize: 11, letterSpacing: 2, marginTop: 8 },
  mlBadge:         { backgroundColor: '#7c3aed', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  mlBadgeText:     { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  commitBtn:       { backgroundColor: '#10b981', height: 75, borderRadius: 24, flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 12 },
  commitText:      { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 2 },
});
