import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import * as api from '../services/api';

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${mo}/${y} ${h}:${mi}`;
}

function SeveritySummary({ inspection }) {
  // Try to get damage info from inspection record if available
  const damages = inspection.damageReport?.damages || [];
  const high = damages.filter((d) => (d.severity || '').toLowerCase() === 'high').length;
  const med = damages.filter((d) => (d.severity || '').toLowerCase() === 'medium').length;
  const low = damages.filter((d) => (d.severity || '').toLowerCase() === 'low').length;
  const total = damages.length;

  if (total === 0) {
    return (
      <View style={styles.severityRow}>
        <Text style={styles.severityText}>Tap to view report</Text>
      </View>
    );
  }

  return (
    <View style={styles.severityRow}>
      <Text style={styles.totalText}>{total} issue{total !== 1 ? 's' : ''}</Text>
      {high > 0 && <View style={[styles.dot, { backgroundColor: Colors.error }]}><Text style={styles.dotText}>{high}H</Text></View>}
      {med > 0 && <View style={[styles.dot, { backgroundColor: Colors.warning }]}><Text style={styles.dotText}>{med}M</Text></View>}
      {low > 0 && <View style={[styles.dot, { backgroundColor: '#FDD835' }]}><Text style={[styles.dotText, { color: '#000' }]}>{low}L</Text></View>}
    </View>
  );
}

export default function ReportsScreen({ navigation }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchReports = async () => {
    try {
      setError(null);
      const res = await api.listInspections();
      const all = res.data?.data || res.data || [];
      const completed = all.filter((i) => i.comparisonStatus === 'completed');
      setReports(completed);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchReports();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('DamageReportScreen', { inspectionId: item._id })}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="file-chart" size={18} color={Colors.aqua} />
        <Text style={styles.vehicleModel} numberOfLines={1}>{item.vehicleModel}</Text>
        <View style={styles.reportReadyBadge}>
          <Text style={styles.reportReadyText}>Report Ready</Text>
        </View>
      </View>
      {item.customerName ? (
        <Text style={styles.customerName}>{item.customerName}</Text>
      ) : null}
      <Text style={styles.dateText}>{formatDate(item.handoverTimestamp)}</Text>
      <SeveritySummary inspection={item} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.aqua} />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle" size={48} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchReports}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reports}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={reports.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.aqua} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="file-chart-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>No Reports Yet</Text>
            <Text style={styles.emptySubtitle}>
              Reports appear here after comparing before &amp; after photos in an inspection.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.midnightNavy },
  center: { flex: 1, backgroundColor: Colors.midnightNavy, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: Colors.textLight, marginTop: 12, fontSize: 14 },
  errorText: { color: Colors.error, marginTop: 12, fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: Colors.oceanBlue, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: Colors.cloudWhite, fontWeight: '600' },
  listContent: { padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 32 },
  emptyTitle: { color: Colors.cloudWhite, fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  emptySubtitle: { color: Colors.textLight, fontSize: 13, marginTop: 8, textAlign: 'center' },
  card: {
    backgroundColor: '#132233',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E3A52',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  vehicleModel: { color: Colors.cloudWhite, fontSize: 15, fontWeight: 'bold', flex: 1 },
  reportReadyBadge: { backgroundColor: Colors.oceanBlue, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  reportReadyText: { color: Colors.cloudWhite, fontSize: 11, fontWeight: '600' },
  customerName: { color: Colors.textLight, fontSize: 13, marginBottom: 3 },
  dateText: { color: Colors.textLight, fontSize: 12, marginBottom: 8 },
  severityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  severityText: { color: Colors.textLight, fontSize: 12 },
  totalText: { color: Colors.cloudWhite, fontSize: 13, fontWeight: '600' },
  dot: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  dotText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
});
