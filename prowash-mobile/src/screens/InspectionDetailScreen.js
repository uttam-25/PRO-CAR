import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
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
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${mo}/${y} ${h}:${mi}:${s}`;
}

function MediaThumbnail({ item, baseUrl, inspectionId, phase }) {
  const isVideo = item.type === 'video' || (item.filename && item.filename.match(/\.(mp4|mov|avi|mkv)$/i));
  // Build URL from inspectionId + phase + filename (matches backend storage path)
  const uri = item.uri || (item.filename && inspectionId && phase
    ? `${baseUrl}/api/uploads/${phase}/${inspectionId}/${item.filename}`
    : null);
  return (
    <View style={styles.thumbnailContainer}>
      {isVideo ? (
        <View style={styles.videoThumb}>
          <MaterialCommunityIcons name="play-circle" size={32} color={Colors.aqua} />
          <Text style={styles.videoLabel} numberOfLines={1}>{item.filename || 'video'}</Text>
        </View>
      ) : uri ? (
        <Image source={{ uri }} style={styles.thumbnail} />
      ) : (
        <View style={styles.videoThumb}>
          <MaterialCommunityIcons name="image-off" size={32} color={Colors.textLight} />
        </View>
      )}
    </View>
  );
}

export default function InspectionDetailScreen({ route, navigation }) {
  const { inspectionId } = route.params || {};
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [afterMedia, setAfterMedia] = useState([]);
  const [error, setError] = useState(null);

  const fetchInspection = async () => {
    try {
      setError(null);
      const res = await api.getInspection(inspectionId);
      setInspection(res.data?.data || res.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load inspection.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchInspection();
    }, [inspectionId])
  );

  const handleStartReturn = async () => {
    Alert.alert('Start Return', 'Mark vehicle as returned and start return inspection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Start Return',
        onPress: async () => {
          setActionLoading(true);
          try {
            await api.startReturn(inspectionId);
            await fetchInspection();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to start return.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets) {
      setAfterMedia((prev) => [...prev, { ...result.assets[0], type: 'image' }]);
    }
  };

  const recordVideo = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 120,
    });
    if (!result.canceled && result.assets) {
      setAfterMedia((prev) => [...prev, { ...result.assets[0], type: 'video' }]);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets) {
      const tagged = result.assets.map((a) => ({ ...a, type: a.type === 'video' ? 'video' : 'image' }));
      setAfterMedia((prev) => [...prev, ...tagged]);
    }
  };

  const uploadAndCompare = async () => {
    setCompareLoading(true);
    try {
      if (afterMedia.length > 0) {
        await api.uploadAfterMedia(inspectionId, afterMedia);
        setAfterMedia([]);
      }
      await api.compareMedia(inspectionId);
      await fetchInspection();
      navigation.navigate('DamageReportScreen', { inspectionId });
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Comparison failed.');
    } finally {
      setCompareLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.aqua} />
        <Text style={styles.loadingText}>Loading inspection...</Text>
      </View>
    );
  }

  if (error || !inspection) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle" size={48} color={Colors.error} />
        <Text style={styles.errorText}>{error || 'Inspection not found.'}</Text>
      </View>
    );
  }

  const isReturned = inspection.returnStatus === 'returned';
  const isCompared = inspection.comparisonStatus === 'completed';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Handover Section */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="car-arrow-right" size={20} color={Colors.aqua} />
          <Text style={styles.cardTitle}>Handover Details</Text>
        </View>

        <InfoRow icon="car" label="Vehicle Model" value={inspection.vehicleModel} />
        {inspection.customerName ? (
          <InfoRow icon="account" label="Customer" value={inspection.customerName} />
        ) : null}
        <InfoRow icon="clock-outline" label="Handover Date & Time" value={formatDateTime(inspection.handoverTimestamp)} highlight />

        {/* Before Media */}
        {inspection.beforeMedia && inspection.beforeMedia.length > 0 && (
          <View style={styles.mediaSection}>
            <Text style={styles.mediaLabel}>Before Inspection Media</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {inspection.beforeMedia.map((item, i) => (
                <MediaThumbnail key={i} item={item} baseUrl={BASE_URL} inspectionId={inspectionId} phase="before" />
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Return Section */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="car-arrow-left" size={20} color={Colors.aqua} />
          <Text style={styles.cardTitle}>Return Inspection</Text>
        </View>

        {!isReturned ? (
          <TouchableOpacity
            style={[styles.actionBtn, actionLoading && styles.btnDisabled]}
            onPress={handleStartReturn}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={Colors.midnightNavy} />
            ) : (
              <>
                <MaterialCommunityIcons name="car-arrow-left" size={20} color={Colors.midnightNavy} />
                <Text style={styles.actionBtnText}>Start Return Inspection</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <InfoRow icon="clock-check" label="Return Date & Time" value={formatDateTime(inspection.returnTimestamp)} highlight />

            {/* Already uploaded after media */}
            {inspection.afterMedia && inspection.afterMedia.length > 0 && (
              <View style={styles.mediaSection}>
                <Text style={styles.mediaLabel}>Return Media (uploaded)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {inspection.afterMedia.map((item, i) => (
                    <MediaThumbnail key={i} item={item} baseUrl={BASE_URL} inspectionId={inspectionId} phase="after" />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* New after media */}
            <Text style={styles.subLabel}>Add Return Photos / Videos</Text>
            <View style={styles.mediaButtons}>
              <TouchableOpacity style={styles.mediaBtn} onPress={takePhoto}>
                <MaterialCommunityIcons name="camera" size={20} color={Colors.cloudWhite} />
                <Text style={styles.mediaBtnText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaBtn} onPress={recordVideo}>
                <MaterialCommunityIcons name="video" size={20} color={Colors.cloudWhite} />
                <Text style={styles.mediaBtnText}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaBtn} onPress={pickFromGallery}>
                <MaterialCommunityIcons name="image-multiple" size={20} color={Colors.cloudWhite} />
                <Text style={styles.mediaBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {afterMedia.length > 0 && (
              <ScrollView horizontal style={{ marginBottom: 12 }} showsHorizontalScrollIndicator={false}>
                {afterMedia.map((item, index) => (
                  <View key={index} style={styles.thumbnailContainer}>
                    {item.type === 'image' ? (
                      <Image source={{ uri: item.uri }} style={styles.thumbnail} />
                    ) : (
                      <View style={styles.videoThumb}>
                        <MaterialCommunityIcons name="play-circle" size={32} color={Colors.aqua} />
                        <Text style={styles.videoLabel} numberOfLines={1}>{item.fileName || 'video.mp4'}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Compare / View Report */}
            {isCompared ? (
              <TouchableOpacity
                style={styles.viewReportBtn}
                onPress={() => navigation.navigate('DamageReportScreen', { inspectionId })}
              >
                <MaterialCommunityIcons name="file-chart" size={20} color={Colors.midnightNavy} />
                <Text style={styles.actionBtnText}>View Damage Report</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.compareBtn, compareLoading && styles.btnDisabled]}
                onPress={uploadAndCompare}
                disabled={compareLoading}
              >
                {compareLoading ? (
                  <ActivityIndicator color={Colors.midnightNavy} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="compare" size={20} color={Colors.midnightNavy} />
                    <Text style={styles.actionBtnText}>Compare Before &amp; After</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <View style={{ height: 40 }} />

      {/* Compare Loading Modal */}
      <Modal visible={compareLoading} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.aqua} />
            <Text style={styles.loadingTitle}>AI Analysis in Progress</Text>
            <Text style={styles.loadingSubText}>Comparing before &amp; after images...</Text>
            <Text style={styles.loadingSubText}>This may take a moment.</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, highlight }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={16} color={Colors.textLight} style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>{value}</Text>
      </View>
    </View>
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E3A52',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { color: Colors.aqua, fontSize: 15, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  infoIcon: { marginTop: 2, marginRight: 8 },
  infoContent: { flex: 1 },
  infoLabel: { color: Colors.textLight, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { color: Colors.cloudWhite, fontSize: 14, marginTop: 2 },
  infoValueHighlight: { color: Colors.aqua, fontWeight: '600' },
  mediaSection: { marginTop: 12 },
  mediaLabel: { color: Colors.textLight, fontSize: 12, marginBottom: 8, fontWeight: '600' },
  subLabel: { color: Colors.textLight, fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  mediaButtons: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  mediaBtn: {
    flex: 1,
    backgroundColor: Colors.oceanBlue,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  mediaBtnText: { color: Colors.cloudWhite, fontSize: 11, fontWeight: '600' },
  thumbnailContainer: { marginRight: 8, position: 'relative' },
  thumbnail: { width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderColor: Colors.oceanBlue },
  videoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#0B1B2B',
    borderWidth: 2,
    borderColor: Colors.oceanBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLabel: { color: Colors.textLight, fontSize: 9, marginTop: 2, maxWidth: 74, textAlign: 'center' },
  actionBtn: {
    backgroundColor: Colors.oceanBlue,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  compareBtn: {
    backgroundColor: Colors.aqua,
    borderRadius: 10,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  viewReportBtn: {
    backgroundColor: Colors.success,
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  actionBtnText: { color: Colors.midnightNavy, fontSize: 15, fontWeight: 'bold' },
  btnDisabled: { opacity: 0.6 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  loadingBox: {
    backgroundColor: '#132233',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    gap: 12,
    minWidth: 240,
    borderWidth: 1,
    borderColor: Colors.oceanBlue,
  },
  loadingTitle: { color: Colors.aqua, fontSize: 16, fontWeight: 'bold' },
  loadingSubText: { color: Colors.textLight, fontSize: 13, textAlign: 'center' },
});
