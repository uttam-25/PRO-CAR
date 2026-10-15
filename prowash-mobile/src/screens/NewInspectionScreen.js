import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import * as api from '../services/api';

const VEHICLE_MODELS = [
  'Maruti Swift',
  'Hyundai Creta',
  'Tata Nexon',
  'Mahindra Scorpio',
  'Toyota Innova',
  'Honda City',
  'Kia Seltos',
  'Maruti Baleno',
  'Hyundai Venue',
  'Tata Punch',
  'Mahindra XUV700',
  'Toyota Fortuner',
  'Maruti Brezza',
  'Hyundai i20',
  'Kia Sonet',
];

function formatDateTime(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${d}/${mo}/${y} ${h}:${mi}:${s}`;
}

export default function NewInspectionScreen({ navigation }) {
  const [vehicleModel, setVehicleModel] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [handoverTime, setHandoverTime] = useState(new Date());
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    requestPermissions();
    timerRef.current = setInterval(() => {
      setHandoverTime(new Date());
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const requestPermissions = async () => {
    await ImagePicker.requestCameraPermissionsAsync();
    await MediaLibrary.requestPermissionsAsync();
  };

  const handleModelChange = (text) => {
    setVehicleModel(text);
    if (text.length > 0) {
      const filtered = VEHICLE_MODELS.filter((m) =>
        m.toLowerCase().includes(text.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const selectSuggestion = (model) => {
    setVehicleModel(model);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets) {
      setMedia((prev) => [...prev, { ...result.assets[0], type: 'image' }]);
    }
  };

  const recordVideo = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 120,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets) {
      setMedia((prev) => [...prev, { ...result.assets[0], type: 'video' }]);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets) {
      const tagged = result.assets.map((a) => ({
        ...a,
        type: a.type === 'video' ? 'video' : 'image',
      }));
      setMedia((prev) => [...prev, ...tagged]);
    }
  };

  const removeMedia = (index) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const saveHandover = async () => {
    if (!vehicleModel.trim()) {
      Alert.alert('Required', 'Please enter or select a vehicle model.');
      return;
    }
    clearInterval(timerRef.current);
    setLoading(true);
    try {
      const res = await api.createInspection(vehicleModel.trim(), customerName.trim());
      const inspectionId = res.data?.data?._id || res.data?._id;
      if (!inspectionId) throw new Error('No inspection ID returned');

      if (media.length > 0) {
        await api.uploadBeforeMedia(inspectionId, media);
      }

      setLoading(false);
      Alert.alert('Saved', 'Handover inspection saved successfully.', [
        {
          text: 'View',
          onPress: () => navigation.navigate('InspectionDetailScreen', { inspectionId }),
        },
        {
          text: 'New',
          onPress: () => {
            setVehicleModel('');
            setCustomerName('');
            setMedia([]);
            timerRef.current = setInterval(() => setHandoverTime(new Date()), 1000);
          },
        },
      ]);
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to save inspection.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROWASH</Text>
        <Text style={styles.headerSub}>Vehicle Inspection & AI Damage Detection</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Vehicle Model */}
        <View style={styles.section}>
          <Text style={styles.label}>Search Vehicle Model *</Text>
          <TextInput
            style={styles.input}
            placeholder="Type car brand or model..."
            placeholderTextColor={Colors.textLight}
            value={vehicleModel}
            onChangeText={handleModelChange}
            onFocus={() => vehicleModel && setShowSuggestions(suggestions.length > 0)}
          />
          {showSuggestions && (
            <View style={styles.suggestionBox}>
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => selectSuggestion(item)}
                  >
                    <Text style={styles.suggestionText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>

        {/* Customer Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Owner / Customer Name (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter customer name..."
            placeholderTextColor={Colors.textLight}
            value={customerName}
            onChangeText={setCustomerName}
          />
        </View>

        {/* Handover Timestamp */}
        <View style={styles.section}>
          <Text style={styles.label}>Handover Date &amp; Time</Text>
          <View style={styles.timestampBox}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={Colors.aqua} />
            <Text style={styles.timestampText}>{formatDateTime(handoverTime)}</Text>
            <Text style={styles.autoLabel}>(auto)</Text>
          </View>
        </View>

        {/* Before Media */}
        <View style={styles.section}>
          <Text style={styles.label}>Before Vehicle Media</Text>
          <View style={styles.mediaButtons}>
            <TouchableOpacity style={styles.mediaBtn} onPress={takePhoto}>
              <MaterialCommunityIcons name="camera" size={22} color={Colors.cloudWhite} />
              <Text style={styles.mediaBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaBtn} onPress={recordVideo}>
              <MaterialCommunityIcons name="video" size={22} color={Colors.cloudWhite} />
              <Text style={styles.mediaBtnText}>Record Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaBtn} onPress={pickFromGallery}>
              <MaterialCommunityIcons name="image-multiple" size={22} color={Colors.cloudWhite} />
              <Text style={styles.mediaBtnText}>Gallery</Text>
            </TouchableOpacity>
          </View>

          {media.length > 0 && (
            <ScrollView horizontal style={styles.thumbnailScroll} showsHorizontalScrollIndicator={false}>
              {media.map((item, index) => (
                <View key={index} style={styles.thumbnailContainer}>
                  {item.type === 'image' ? (
                    <Image source={{ uri: item.uri }} style={styles.thumbnail} />
                  ) : (
                    <View style={styles.videoThumb}>
                      <MaterialCommunityIcons name="play-circle" size={36} color={Colors.aqua} />
                      <Text style={styles.videoLabel} numberOfLines={1}>
                        {item.fileName || 'video.mp4'}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeMedia(index)}
                  >
                    <MaterialCommunityIcons name="close-circle" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={saveHandover}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.midnightNavy} />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save" size={20} color={Colors.midnightNavy} />
              <Text style={styles.saveBtnText}>Save Handover Inspection</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Loading overlay */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.aqua} />
            <Text style={styles.loadingText}>Saving inspection...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.midnightNavy },
  header: {
    backgroundColor: Colors.midnightNavy,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.oceanBlue,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.aqua, letterSpacing: 2 },
  headerSub: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  scroll: { flex: 1, paddingHorizontal: 16 },
  section: { marginTop: 20 },
  label: { fontSize: 13, color: Colors.textLight, marginBottom: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#132233',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.cloudWhite,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.oceanBlue,
  },
  suggestionBox: {
    backgroundColor: '#1A3248',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.oceanBlue,
    marginTop: 2,
    zIndex: 999,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#0F2437',
  },
  suggestionText: { color: Colors.cloudWhite, fontSize: 14 },
  timestampBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#132233',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.oceanBlue,
    gap: 8,
  },
  timestampText: { color: Colors.aqua, fontSize: 15, fontWeight: '600', flex: 1 },
  autoLabel: { color: Colors.textLight, fontSize: 11 },
  mediaButtons: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  mediaBtn: {
    flex: 1,
    backgroundColor: Colors.oceanBlue,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  mediaBtnText: { color: Colors.cloudWhite, fontSize: 11, fontWeight: '600' },
  thumbnailScroll: { marginBottom: 8 },
  thumbnailContainer: { marginRight: 10, position: 'relative' },
  thumbnail: { width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderColor: Colors.oceanBlue },
  videoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#132233',
    borderWidth: 2,
    borderColor: Colors.oceanBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLabel: { color: Colors.textLight, fontSize: 9, marginTop: 2, maxWidth: 75, textAlign: 'center' },
  removeBtn: { position: 'absolute', top: -6, right: -6 },
  saveBtn: {
    backgroundColor: Colors.aqua,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.midnightNavy, fontSize: 16, fontWeight: 'bold' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  loadingBox: {
    backgroundColor: '#132233',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    minWidth: 200,
  },
  loadingText: { color: Colors.cloudWhite, fontSize: 14 },
});
