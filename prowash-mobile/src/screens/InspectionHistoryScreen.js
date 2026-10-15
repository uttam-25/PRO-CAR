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

function StatusBadge({ label, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export default function InspectionHistoryScreen({ navigation }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchInspections = async () => {
    try {
      setError(null);
      const res = await api.listInspections();
      setInspections(res.data?.data || res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load inspections.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchInspections();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchInspections();
  };

  const renderItem = ({ item }) => {
    const returnStatus = item.returnStatus === 'returned' ? 'Returned' : 'Awaiting Return';
    const returnColor = item.returnStatus === 'returned' ? Colors.success : Colors.warning;
    const compareStatus = item.comparisonStatus === 'completed' ? 'Report Ready' : 'Not Compared';
    const compareColor = item.comparisonStatus === 'completed' ? Colors.oceanBlue : Colors.textLight;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('InspectionDetailScreen', { inspectionId: item._id })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="car" size={20} color={Colors.aqua} />
          <Text style={styles.vehicleModel} numberOfLines={1}>{item.vehicleModel}</Text>
        </View>
        {item.customerName ? (
          <Text style={styles.customerName}>
            <MaterialCommunityIcons name="account" size={13} color={Colors.textLight} /> {item.customerName}
          </Text>
        ) : null}
        <Text style={styles.dateText}>
          <MaterialCommunityIcons name="clock-outline" size={13} color={Colors.textLight} />{' '}
          {formatDate(item.handoverTimestamp)}
        </Text>
        <View style={styles.badgeRow}>
          <StatusBadge label={returnStatus} color={returnColor} />
          <StatusBadge label={compareStatus} color={compareColor} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.aqua} />
        <Text style={styles.loadingText}>Loading inspections...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle" size={48} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchInspections}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={inspections}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={inspections.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.aqua} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>No Inspections Yet</Text>
            <Text style={styles.emptySubtitle}>Create your first vehicle inspection from the New Inspection tab.</Text>
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
  vehicleModel: { color: Colors.cloudWhite, fontSize: 16, fontWeight: 'bold', flex: 1 },
  customerName: { color: Colors.textLight, fontSize: 13, marginBottom: 4 },
  dateText: { color: Colors.textLight, fontSize: 12, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: Colors.cloudWhite, fontSize: 11, fontWeight: '600' },
});
