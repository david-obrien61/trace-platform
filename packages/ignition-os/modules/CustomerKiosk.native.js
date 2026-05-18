/**
 * FILE: modules/CustomerKiosk.native.js
 * PLATFORM: Mobile (React Native / Expo — iPad)
 * PURPOSE: Customer-facing front-desk kiosk.
 *          Two flows: (1) Estimate approval + signature, (2) Vehicle pickup signature.
 *          Staff exits via the tiny X in the top-left corner.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, PanResponder, Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  CheckCircle, AlertCircle, ChevronRight,
  RotateCcw, Shield, X, Car,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import DataBridge from '../DataBridge';

const { width: SW } = Dimensions.get('window');
const fmt$ = (n) => `$${(parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const buildLineItems = (job) => {
  const items = [];
  if ((job?.suggestedParts?.length || 0) > 0) {
    items.push({ desc: 'Standard Diagnostic Fee', retail: 195.00 });
  }
  (job?.suggestedParts || []).forEach(part => {
    items.push({
      desc: `${part.name} (x${part.qty})`,
      retail: part.retailPrice || 0,
    });
  });
  (job?.tasks || []).forEach(task => {
    if ((task.billed_hours || 0) > 0) {
      items.push({
        desc: `Labor: ${task.description} (${task.billed_hours}h @ $${task.rate}/hr)`,
        retail: task.billed_hours * task.rate,
      });
    }
  });
  if (parseFloat(job?.incidentals) > 0) {
    items.push({ desc: 'Shop Supplies & Env. Fees', retail: parseFloat(job.incidentals) });
  }
  return items;
};

// ─── SIGNATURE PAD ─────────────────────────────────────────────────────────────

const SignaturePad = ({ onHasSignature }) => {
  const livePathRef = useRef('');
  const [allPaths, setAllPaths] = useState([]);
  const [livePath, setLivePath] = useState('');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        livePathRef.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setLivePath(livePathRef.current);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        livePathRef.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setLivePath(livePathRef.current);
      },
      onPanResponderRelease: () => {
        if (livePathRef.current) {
          const captured = livePathRef.current;
          setAllPaths(prev => [...prev, captured]);
          onHasSignature(true);
        }
        livePathRef.current = '';
        setLivePath('');
      },
    })
  ).current;

  const clear = () => {
    setAllPaths([]);
    setLivePath('');
    livePathRef.current = '';
    onHasSignature(false);
  };

  return (
    <View>
      <View {...panResponder.panHandlers} style={styles.sigPad}>
        <Svg height={160} width="100%">
          {allPaths.map((d, i) => (
            <Path key={i} d={d} stroke="#10b981" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {livePath ? (
            <Path d={livePath} stroke="#10b981" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
        {allPaths.length === 0 && !livePath && (
          <View style={styles.sigHintOverlay} pointerEvents="none">
            <Text style={styles.sigHintText}>Sign Here</Text>
            <Text style={styles.sigHintSub}>Use your finger or stylus</Text>
          </View>
        )}
      </View>
      {allPaths.length > 0 && (
        <TouchableOpacity onPress={clear} style={styles.clearBtn}>
          <RotateCcw color="#475569" size={12} />
          <Text style={styles.clearBtnText}>Clear & Re-sign</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── CONSENT CHECKBOX ─────────────────────────────────────────────────────────

const ConsentCheck = ({ checked, onPress, label }) => (
  <TouchableOpacity style={styles.consentRow} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
      {checked && <CheckCircle color="#fff" size={14} />}
    </View>
    <Text style={styles.consentText}>{label}</Text>
  </TouchableOpacity>
);

// ─── SUCCESS SCREEN ───────────────────────────────────────────────────────────

const SuccessScreen = ({ isPickup }) => (
  <View style={styles.successWrap}>
    <View style={styles.successCircle}>
      <CheckCircle color="#fff" size={56} />
    </View>
    <Text style={styles.successTitle}>
      {isPickup ? 'Pickup Confirmed!' : 'Work Authorized!'}
    </Text>
    <Text style={styles.successSub}>
      {isPickup
        ? 'Thank you! Your vehicle has been released. Drive safe!'
        : "We'll contact you when your vehicle is ready."}
    </Text>
  </View>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function CustomerKiosk({ job, onAuthorized, onPickupSigned, onExit }) {
  const isPickup = job?.status === 'READY_FOR_PICKUP' || job?.status === 'COMPLETED';

  const [screen, setScreen] = useState(isPickup ? 'pickup_review' : 'estimate_review');
  const [hasSignature, setHasSignature] = useState(false);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    setScreen(isPickup ? 'pickup_review' : 'estimate_review');
    setHasSignature(false);
    setConsent(false);
  }, [job?.jobId, isPickup]);

  const shopInfo = DataBridge.load('shop_info') || {};
  const items = buildLineItems(job);
  const total = items.reduce((sum, i) => sum + (i.retail || 0), 0);
  const woId = job?.jobId || job?.id || 'WO-???';
  const vehicle = [job?.year, job?.make, job?.model].filter(Boolean).join(' ').toUpperCase() || 'VEHICLE';
  const customerName = job?.name || 'Customer';
  const shopName = shopInfo.name || 'Ignition OS';

  const resetSig = () => { setHasSignature(false); setConsent(false); };

  // ── SUCCESS ──────────────────────────────────────────────────────────────────
  if (screen === 'estimate_success' || screen === 'pickup_success') {
    return <SuccessScreen isPickup={screen === 'pickup_success'} />;
  }

  // ── ESTIMATE REVIEW ──────────────────────────────────────────────────────────
  if (screen === 'estimate_review') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.page}>
        <TouchableOpacity style={styles.staffExit} onPress={onExit}>
          <X color="#1e293b" size={14} />
        </TouchableOpacity>

        <Text style={styles.shopName}>{shopName}</Text>
        <Text style={styles.pageHeading}>Repair Estimate</Text>
        <Text style={styles.woTag}>Work Order #{woId}</Text>

        {/* Customer / Vehicle */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PREPARED FOR</Text>
          <Text style={styles.bigName}>{customerName}</Text>
          <Text style={styles.vehicleText}>{vehicle}</Text>
          {job?.vin ? <Text style={styles.vinText}>VIN: {job.vin}</Text> : null}
        </View>

        {/* Reported Issue */}
        <View style={[styles.card, { borderColor: '#f59e0b' }]}>
          <Text style={[styles.cardLabel, { color: '#f59e0b' }]}>REPORTED ISSUE</Text>
          <Text style={styles.cardItalic}>
            "{job?.complaint || job?.problem || 'No specific problem reported.'}"
          </Text>
        </View>

        {/* Advisories */}
        {job?.advisories ? (
          <View style={[styles.card, { borderColor: '#475569' }]}>
            <View style={styles.cardRow}>
              <AlertCircle color="#475569" size={14} />
              <Text style={[styles.cardLabel, { color: '#475569', marginBottom: 0, marginLeft: 6 }]}>
                ADVISORY — NOT AUTHORIZED THIS VISIT
              </Text>
            </View>
            <View style={{ height: 8 }} />
            {job.advisories.split('\n').filter(Boolean).map((line, i) => (
              <Text key={i} style={styles.advisoryLine}>· {line}</Text>
            ))}
          </View>
        ) : null}

        {/* Line Items */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ESTIMATE BREAKDOWN</Text>
          {items.length === 0 ? (
            <Text style={styles.cardText}>No itemized charges on this estimate.</Text>
          ) : (
            items.map((item, i) => (
              <View key={i} style={styles.lineRow}>
                <Text style={styles.lineDesc} numberOfLines={2}>{item.desc}</Text>
                <Text style={styles.linePrice}>{fmt$(item.retail)}</Text>
              </View>
            ))
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>ESTIMATED TOTAL</Text>
            <Text style={styles.totalAmount}>{fmt$(total)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => { resetSig(); setScreen('estimate_sig'); }}
        >
          <ChevronRight color="#fff" size={20} />
          <Text style={styles.primaryBtnText}>Review & Sign</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── ESTIMATE SIGNATURE ───────────────────────────────────────────────────────
  if (screen === 'estimate_sig') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.page}>
        <TouchableOpacity style={styles.staffExit} onPress={onExit}>
          <X color="#1e293b" size={14} />
        </TouchableOpacity>

        <Text style={styles.shopName}>{shopName}</Text>
        <Text style={styles.pageHeading}>Authorize Repairs</Text>
        <Text style={styles.woTag}>WO #{woId} · {vehicle}</Text>

        <View style={[styles.card, { borderColor: '#3b82f6' }]}>
          <Text style={[styles.cardLabel, { color: '#3b82f6' }]}>YOUR SIGNATURE</Text>
          <Text style={styles.cardText}>
            By signing below, you authorize {shopName} to perform the repairs in your estimate.
          </Text>
          <View style={{ height: 16 }} />
          <SignaturePad onHasSignature={setHasSignature} />
          <View style={{ height: 16 }} />
          <ConsentCheck
            checked={consent}
            onPress={() => setConsent(c => !c)}
            label="I authorize the above repairs. I understand the final invoice may differ if additional issues are found during service."
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, (!hasSignature || !consent) && styles.primaryBtnDisabled]}
          disabled={!hasSignature || !consent}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setScreen('estimate_success');
            setTimeout(() => onAuthorized?.(), 2800);
          }}
        >
          <Shield color={hasSignature && consent ? '#fff' : '#475569'} size={20} />
          <Text style={[styles.primaryBtnText, (!hasSignature || !consent) && { color: '#475569' }]}>
            Authorize Repairs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backLink} onPress={() => setScreen('estimate_review')}>
          <Text style={styles.backLinkText}>← Back to Estimate</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── PICKUP REVIEW ────────────────────────────────────────────────────────────
  if (screen === 'pickup_review') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.page}>
        <TouchableOpacity style={styles.staffExit} onPress={onExit}>
          <X color="#1e293b" size={14} />
        </TouchableOpacity>

        <Text style={styles.shopName}>{shopName}</Text>
        <Text style={styles.pageHeading}>Vehicle Ready</Text>
        <Text style={styles.woTag}>Work Order #{woId}</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>CUSTOMER</Text>
          <Text style={styles.bigName}>{customerName}</Text>
          <Text style={styles.vehicleText}>{vehicle}</Text>
        </View>

        <View style={[styles.card, { borderColor: '#10b981' }]}>
          <Text style={[styles.cardLabel, { color: '#10b981' }]}>WORK COMPLETED</Text>
          {items.map((item, i) => (
            <View key={i} style={styles.lineRow}>
              <Text style={styles.lineDesc} numberOfLines={2}>{item.desc}</Text>
              <Text style={styles.linePrice}>{fmt$(item.retail)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalAmount}>{fmt$(total)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => { resetSig(); setScreen('pickup_sig'); }}
        >
          <Car color="#fff" size={20} />
          <Text style={styles.primaryBtnText}>Sign for Pickup</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── PICKUP SIGNATURE ─────────────────────────────────────────────────────────
  if (screen === 'pickup_sig') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.page}>
        <TouchableOpacity style={styles.staffExit} onPress={onExit}>
          <X color="#1e293b" size={14} />
        </TouchableOpacity>

        <Text style={styles.shopName}>{shopName}</Text>
        <Text style={styles.pageHeading}>Sign for Pickup</Text>
        <Text style={styles.woTag}>WO #{woId} · {vehicle}</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>CONFIRM VEHICLE PICKUP</Text>
          <Text style={styles.cardText}>
            By signing below, you confirm you are taking possession of this vehicle in its repaired condition.
          </Text>
        </View>

        <View style={[styles.card, { borderColor: '#3b82f6' }]}>
          <Text style={[styles.cardLabel, { color: '#3b82f6' }]}>YOUR SIGNATURE</Text>
          <View style={{ height: 8 }} />
          <SignaturePad onHasSignature={setHasSignature} />
          <View style={{ height: 16 }} />
          <ConsentCheck
            checked={consent}
            onPress={() => setConsent(c => !c)}
            label="I confirm I am taking possession of my vehicle and all completed repairs are satisfactory."
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, (!hasSignature || !consent) && styles.primaryBtnDisabled]}
          disabled={!hasSignature || !consent}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setScreen('pickup_success');
            setTimeout(() => onPickupSigned?.(), 2800);
          }}
        >
          <Shield color={hasSignature && consent ? '#fff' : '#475569'} size={20} />
          <Text style={[styles.primaryBtnText, (!hasSignature || !consent) && { color: '#475569' }]}>
            Confirm Pickup
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backLink} onPress={() => setScreen('pickup_review')}>
          <Text style={styles.backLinkText}>← Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
  page: { padding: 24, paddingBottom: 60, maxWidth: 640, alignSelf: 'center', width: '100%' },

  staffExit: {
    position: 'absolute', top: 8, left: 8, zIndex: 10,
    padding: 10, backgroundColor: '#0f172a', borderRadius: 10,
  },

  shopName: { color: '#334155', fontSize: 11, fontWeight: '900', letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginTop: 10 },
  pageHeading: { color: '#f8fafc', fontSize: 28, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5, textAlign: 'center', marginTop: 4 },
  woTag: { color: '#475569', fontSize: 10, fontWeight: '700', letterSpacing: 2, textAlign: 'center', marginBottom: 24, marginTop: 4 },

  card: { backgroundColor: '#0f172a', borderRadius: 20, borderWidth: 1, borderColor: '#1e293b', padding: 20, marginBottom: 14 },
  cardLabel: { color: '#475569', fontSize: 9, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardText: { color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  cardItalic: { color: '#cbd5e1', fontSize: 14, fontStyle: 'italic', lineHeight: 22 },

  bigName: { color: '#f8fafc', fontSize: 22, fontWeight: '900', letterSpacing: -0.5, textTransform: 'uppercase' },
  vehicleText: { color: '#94a3b8', fontSize: 14, fontWeight: '700', marginTop: 2 },
  vinText: { color: '#334155', fontSize: 11, fontFamily: 'monospace', marginTop: 4 },
  advisoryLine: { color: '#64748b', fontSize: 13, lineHeight: 20 },

  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  lineDesc: { color: '#94a3b8', fontSize: 13, flex: 1, paddingRight: 10, lineHeight: 18 },
  linePrice: { color: '#f8fafc', fontSize: 14, fontWeight: '900' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  totalLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  totalAmount: { color: '#10b981', fontSize: 32, fontWeight: '900', fontStyle: 'italic' },

  sigPad: { height: 160, backgroundColor: '#000', borderRadius: 14, borderWidth: 2, borderColor: '#1e293b', overflow: 'hidden', position: 'relative' },
  sigHintOverlay: { position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', top: 0, left: 0, right: 0, bottom: 0 },
  sigHintText: { color: '#1e293b', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
  sigHintSub: { color: '#0f172a', fontSize: 11, marginTop: 4 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  clearBtnText: { color: '#475569', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },

  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 16 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#334155', justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  checkboxOn: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  consentText: { color: '#64748b', fontSize: 12, lineHeight: 18, flex: 1 },

  primaryBtn: { backgroundColor: '#10b981', flexDirection: 'row', height: 72, borderRadius: 22, justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 16 },
  primaryBtnDisabled: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  backLink: { alignItems: 'center', paddingVertical: 10 },
  backLinkText: { color: '#334155', fontSize: 12, fontWeight: '700' },

  successWrap: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center', padding: 40 },
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', marginBottom: 24, shadowColor: '#10b981', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  successTitle: { color: '#f8fafc', fontSize: 28, fontWeight: '900', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: -0.5, textAlign: 'center' },
  successSub: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 22, maxWidth: 320 },
});
