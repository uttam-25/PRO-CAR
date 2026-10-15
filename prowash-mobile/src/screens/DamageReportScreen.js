import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import * as api from '../services/api';
import { BASE_URL } from '../services/api';

function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${mo}/${y} ${h}:${mi}`;
}

function SeverityBadge({ severity }) {
  const colors = {
    High: Colors.error,
    Medium: Colors.warning,
    Low: '#FDD835',
    high: Colors.error,
    medium: Colors.warning,
    low: '#FDD835',
  };
  const bg = colors[severity] || Colors.textLight;
  return (
    <View style={[styles.severityBadge, { backgroundColor: bg }]}>
      <Text style={styles.severityText}>{severity}</Text>
    </View>
  );
}

function ConfidenceBar({ confidence }) {
  const pct = Math.round((confidence || 0) * 100);
  const barColor = pct > 70 ? Colors.error : pct > 40 ? Colors.warning : Colors.success;
  return (
    <View style={styles.confidenceContainer}>
      <Text style={styles.confidenceLabel}>Confidence: {pct}%</Text>
      <View style={styles.confidenceTrack}>
        <View style={[styles.confidenceFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

export default function DamageReportScreen({ route }) {
  const { inspectionId } = route.params || {};
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api
        .getReport(inspectionId)
        .then((res) => {
          setReport(res.data?.data || res.data);
        })
        .catch((err) => {
          setError(err?.response?.data?.message || err.message || 'Failed to load report.');
        })
        .finally(() => setLoading(false));
    }, [inspectionId])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.aqua} />
        <Text style={styles.loadingText}>Loading damage report...</Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle" size={48} color={Colors.error} />
        <Text style={styles.errorText}>{error || 'Report not found.'}</Text>
      </View>
    );
  }

  // Image URL helpers — files are stored under uploads/<phase>/<inspectionId>/<filename>
  const getBeforeUrl = (filename) =>
    filename ? `${BASE_URL}/api/uploads/before/${report.inspectionId}/${filename}` : null;
  const getAnnotatedUrl = (filename) =>
    filename ? `${BASE_URL}/api/uploads/after/${report.inspectionId}/${filename}` : null;

  const damages = report.damages || report.damageItems || [];
  const noDamage = report.noDamageDetected || (damages.length === 0 && !report.warningMessage);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header / Summary Card */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="file-chart" size={20} color={Colors.aqua} />
          <Text style={styles.cardTitle}>Damage Report</Text>
        </View>
        <Text style={styles.vehicleModel}>{report.vehicleModel}</Text>
        {report.customerName ? <Text style={styles.metaText}>Customer: {report.customerName}</Text> : null}
        <Text style={styles.metaText}>Handover: {formatDateTime(report.handoverTimestamp)}</Text>
        <Text style={styles.metaText}>Returned: {formatDateTime(report.returnTimestamp)}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{damages.length}</Text>
            <Text style={styles.summaryLabel}>Issues Found</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: Colors.error }]}>
              {damages.filter((d) => (d.severity || '').toLowerCase() === 'high').length}
            </Text>
            <Text style={styles.summaryLabel}>High Severity</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: Colors.warning }]}>
              {damages.filter((d) => (d.severity || '').toLowerCase() === 'medium').length}
            </Text>
            <Text style={styles.summaryLabel}>Medium</Text>
          </View>
        </View>
      </View>

      {/* No Damage Banner */}
      {noDamage && (
        <View style={styles.noDamageBanner}>
          <MaterialCommunityIcons name="check-circle" size={24} color={Colors.success} />
          <Text style={styles.noDamageText}>No obvious new damage detected.</Text>
        </View>
      )}

      {/* Warning Banner */}
      {report.warningMessage ? (
        <View style={styles.warningBanner}>
          <MaterialCommunityIcons name="alert" size={22} color={Colors.warning} />
          <Text style={styles.warningText}>{report.warningMessage}</Text>
        </View>
      ) : null}

      {/* Damage Items */}
      {damages.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Suspected Damage</Text>
          {damages.map((item, index) => (
            <View key={index} style={styles.damageItem}>
              <View style={styles.damageHeader}>
                <Text style={styles.damageType}>{item.damageType || item.type || 'Unknown'}</Text>
                <SeverityBadge severity={item.severity} />
              </View>
              <Text style={styles.damageLocation}>
                <MaterialCommunityIcons name="map-marker" size={13} color={Colors.textLight} />{' '}
                {item.location || 'N/A'}
              </Text>
              {item.description ? <Text style={styles.damageDesc}>{item.description}</Text> : null}
              {(item.confidenceScore !== undefined || item.confidence !== undefined) && (
                <ConfidenceBar confidence={item.confidenceScore ?? item.confidence} />
              )}
            </View>
          ))}
        </View>
      )}

      {/* Before / After Image Comparison — driven by report.annotatedImages */}
      {Array.isArray(report.annotatedImages) && report.annotatedImages.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="compare" size={20} color={Colors.aqua} />
            <Text style={styles.cardTitle}>Before &amp; After Comparison</Text>
          </View>
          {report.annotatedImages.map((img, index) => (
            <View key={index} style={styles.comparisonBlock}>
              <Text style={styles.comparisonIndex}>Image pair {index + 1}</Text>
              {img.madScore !== undefined && (
                <Text style={styles.madScore}>Difference score (MAD): {img.madScore}</Text>
              )}
              <View style={styles.imageRow}>
                <View style={styles.imageCol}>
                  <Text style={styles.imageLabel}>Before</Text>
                  <Image
                    source={{ uri: getBeforeUrl(img.originalFilename) }}
                    style={styles.compImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.imageCol}>
                  <Text style={styles.imageLabel}>After (annotated)</Text>
                  <Image
                    source={{ uri: getAnnotatedUrl('annotated_' + img.originalFilename) }}
                    style={styles.compImage}
                    resizeMode="cover"
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Comparison Summary */}
      {report.comparisonSummary ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Comparison Summary</Text>
          <Text style={styles.summaryBodyText}>{report.comparisonSummary}</Text>
        </View>
      ) : null}

      {/* Disclaimer */}
      <View style={styles.disclaimerBox}>
        <MaterialCommunityIcons name="information-outline" size={16} color={Colors.textLight} />
        <Text style={styles.disclaimerText}>
          AI results are labeled as <Text style={{ fontStyle: 'italic' }}>suspected damage</Text> and require agent review. AI cannot guarantee detection of every scratch or defect.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.midnightNavy },
  content: { padding: 16 },
  center: { flex: 1, backgroundColor: Colors.midnightNavy, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: Colors.textLight, marginTop: 12, fontSize: 14 },
  errorText: { color: Colors.error, marginTop: 12, fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: '#132233',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E3A52',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { color: Colors.aqua, fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  vehicleModel: { color: Colors.cloudWhite, fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  metaText: { color: Colors.textLight, fontSize: 13, marginBottom: 3 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#1E3A52' },
  summaryItem: { alignItems: 'center' },
  summaryNum: { color: Colors.aqua, fontSize: 22, fontWeight: 'bold' },
  summaryLabel: { color: Colors.textLight, fontSize: 11, marginTop: 2 },
  noDamageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B3A1B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  noDamageText: { color: Colors.success, fontSize: 15, fontWeight: '600', flex: 1 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#3A2B0F',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  warningText: { color: Colors.warning, fontSize: 14, flex: 1 },
  damageItem: {
    borderTopWidth: 1,
    borderTopColor: '#1E3A52',
    paddingTop: 14,
    marginTop: 14,
  },
  damageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  damageType: { color: Colors.cloudWhite, fontSize: 15, fontWeight: '600' },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  severityText: { color: '#000', fontSize: 12, fontWeight: 'bold' },
  damageLocation: { color: Colors.textLight, fontSize: 13, marginBottom: 6 },
  damageDesc: { color: Colors.textLight, fontSize: 13, marginBottom: 8, fontStyle: 'italic' },
  confidenceContainer: { marginBottom: 10 },
  confidenceLabel: { color: Colors.textLight, fontSize: 12, marginBottom: 4 },
  confidenceTrack: { height: 6, backgroundColor: '#1E3A52', borderRadius: 3, overflow: 'hidden' },
  confidenceFill: { height: 6, borderRadius: 3 },
  imageRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  imageCol: { flex: 1 },
  imageLabel: { color: Colors.textLight, fontSize: 11, marginBottom: 4, textAlign: 'center' },
  compImage: { width: '100%', height: 120, borderRadius: 8, borderWidth: 1, borderColor: Colors.oceanBlue },
  summaryBodyText: { color: Colors.cloudWhite, fontSize: 14, lineHeight: 20 },
  comparisonBlock: {
    borderTopWidth: 1,
    borderTopColor: '#1E3A52',
    paddingTop: 14,
    marginTop: 14,
  },
  comparisonIndex: { color: Colors.cloudWhite, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  madScore: { color: Colors.textLight, fontSize: 12, marginBottom: 8 },
  disclaimerBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#0F1E2C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E3A52',
  },
  disclaimerText: { color: Colors.textLight, fontSize: 12, flex: 1, lineHeight: 17 },
});
