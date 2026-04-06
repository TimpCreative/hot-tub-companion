import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../../../../components/ui/Button';
import api from '../../../../../services/api';
import { useTenant } from '../../../../../contexts/TenantContext';
import { useTheme } from '../../../../../theme/ThemeProvider';
import { labelForSanitationOption } from '../../../../../constants/sanitizationSystems';

type SpaProfile = {
  id: string;
  brand?: string | null;
  modelLine?: string | null;
  model?: string | null;
  year?: number | null;
  nickname?: string | null;
  serialNumber?: string | null;
  sanitizationSystem?: string | null;
  usageMonths?: number[] | null;
  winterStrategy?: 'shutdown' | 'operate';
  warrantyExpirationDate?: string | null;
  lastFilterChange?: string | null;
};

const SEASON_PRESETS: { key: string; label: string; months: number[] }[] = [
  { key: 'spring', label: 'Spring', months: [3, 4, 5] },
  { key: 'summer', label: 'Summer', months: [6, 7, 8] },
  { key: 'autumn', label: 'Autumn', months: [9, 10, 11] },
  { key: 'winter', label: 'Winter', months: [12, 1, 2] },
];

export default function EditSpaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { config } = useTenant();
  const { colors } = useTheme();

  const [spa, setSpa] = useState<SpaProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nickname, setNickname] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [sanitizationSystem, setSanitizationSystem] = useState<string>('');
  const [usageMonths, setUsageMonths] = useState<number[]>([]);
  const [winterStrategy, setWinterStrategy] = useState<'shutdown' | 'operate'>('operate');
  const [warrantyDate, setWarrantyDate] = useState('');

  const sanitizerOptions =
    config?.sanitationSystemOptions && config.sanitationSystemOptions.length > 0
      ? config.sanitationSystemOptions
      : [
          { value: 'bromine', displayName: 'Bromine' },
          { value: 'chlorine', displayName: 'Chlorine' },
          { value: 'frog_ease', displayName: 'Frog @Ease' },
          { value: 'copper', displayName: 'Copper' },
          { value: 'silver_mineral', displayName: 'Silver / Mineral stick' },
        ];

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = (await api.get('/spa-profiles')) as { data?: { spaProfiles?: SpaProfile[] } };
      const list = res?.data?.spaProfiles ?? [];
      const found = list.find((p) => p.id === id);
      if (found) {
        setSpa(found);
        setNickname(found.nickname ?? '');
        setSerialNumber(found.serialNumber ?? '');
        setSanitizationSystem(found.sanitizationSystem ?? '');
        setUsageMonths(Array.isArray(found.usageMonths) ? [...found.usageMonths] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        setWinterStrategy(found.winterStrategy === 'shutdown' ? 'shutdown' : 'operate');
        setWarrantyDate(
          found.warrantyExpirationDate
            ? new Date(found.warrantyExpirationDate).toISOString().slice(0, 10)
            : ''
        );
      } else {
        router.back();
      }
    } catch {
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleMonth = (m: number) => {
    setUsageMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)
    );
  };

  const toggleSeasonMonths = (months: number[]) => {
    setUsageMonths((prev) => {
      const allSelected = months.every((m) => prev.includes(m));
      if (allSelected) {
        return prev.filter((m) => !months.includes(m)).sort((a, b) => a - b);
      }
      return [...new Set([...prev, ...months])].sort((a, b) => a - b);
    });
  };

  const handleSave = async () => {
    if (!id || !spa || saving) return;
    setSaving(true);
    try {
      await api.put(`/spa-profiles/${id}`, {
        nickname: nickname.trim() || null,
        serialNumber: serialNumber.trim() || null,
        sanitizationSystem: sanitizationSystem || undefined,
        usageMonths: usageMonths.length > 0 ? usageMonths : undefined,
        warrantyExpirationDate: warrantyDate ? new Date(warrantyDate).toISOString().slice(0, 10) : null,
      });
      router.back();
    } catch (err) {
      if (err && typeof err === 'object' && 'error' in err) {
        const e = (err as { error?: { message?: string } }).error;
        alert(e?.message ?? 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || !spa) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const readOnlyLine = [spa.brand, spa.modelLine || spa.model, spa.year].filter(Boolean).join(' · ');

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Spa (cannot change)</Text>
        <Text style={[styles.readOnly, { color: colors.text }]}>{readOnlyLine}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          To change brand/model/year, delete this spa and add it again.
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Nickname</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={nickname}
          onChangeText={setNickname}
          placeholder="e.g. Backyard spa"
        />
      </View>

      <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Serial number</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={serialNumber}
          onChangeText={setSerialNumber}
          placeholder="Serial number"
        />
      </View>

      <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Sanitation system</Text>
        <Text style={[styles.warning, { color: colors.textMuted }]}>
          Changing your sanitation system will update your product recommendations.
        </Text>
        {sanitizerOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              { borderColor: colors.border },
              sanitizationSystem === option.value && { borderColor: colors.primary, backgroundColor: `${colors.primary}20` },
            ]}
            onPress={() => setSanitizationSystem(option.value)}
          >
            <Text style={[styles.optionText, { color: colors.text }]}>
              {labelForSanitationOption(option.value, sanitizerOptions)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Usage months</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Northern seasons (tap to toggle a group). Fine-tune with month letters below.
        </Text>
        <View style={styles.seasonRow}>
          {SEASON_PRESETS.map((s) => {
            const active = s.months.every((m) => usageMonths.includes(m));
            return (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.seasonChip,
                  { borderColor: colors.border },
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => toggleSeasonMonths(s.months)}
              >
                <Text style={[styles.seasonChipText, { color: active ? '#fff' : colors.text }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.textMuted, marginTop: 12 }]}>
          Which months do you use your tub? Toggle off months you winterize.
        </Text>
        <View style={styles.monthsRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.monthBtn,
                { borderColor: colors.border },
                usageMonths.includes(m) && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => toggleMonth(m)}
            >
              <Text
                style={[
                  styles.monthText,
                  { color: usageMonths.includes(m) ? '#fff' : colors.text },
                ]}
              >
                {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][m - 1]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>When you are not using the tub</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Shutdown adds winterize and spring startup tasks when you have off-months. Operate skips those pairs.
        </Text>
        <View style={styles.strategyRow}>
          <TouchableOpacity
            style={[
              styles.strategyOption,
              { borderColor: colors.border },
              winterStrategy === 'shutdown' && { borderColor: colors.primary, backgroundColor: `${colors.primary}18` },
            ]}
            onPress={() => setWinterStrategy('shutdown')}
          >
            <Text style={[styles.strategyTitle, { color: colors.text }]}>Shut down when not in use</Text>
            <Text style={[styles.strategySub, { color: colors.textMuted }]}>Winterize during off months</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.strategyOption,
              { borderColor: colors.border },
              winterStrategy === 'operate' && { borderColor: colors.primary, backgroundColor: `${colors.primary}18` },
            ]}
            onPress={() => setWinterStrategy('operate')}
          >
            <Text style={[styles.strategyTitle, { color: colors.text }]}>Keep running year-round</Text>
            <Text style={[styles.strategySub, { color: colors.textMuted }]}>No full winterize / startup pair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.contentBackground }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Warranty expiration date</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={warrantyDate}
          onChangeText={setWarrantyDate}
          placeholder="YYYY-MM-DD"
        />
      </View>

      <Button title="Save" onPress={handleSave} loading={saving} />
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: 24, padding: 16, borderRadius: 12 },
  label: { fontSize: 13, marginBottom: 8 },
  readOnly: { fontSize: 16, marginBottom: 4 },
  hint: { fontSize: 13, marginBottom: 8 },
  warning: { fontSize: 13, marginBottom: 12, fontStyle: 'italic' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  option: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  optionText: { fontSize: 16 },
  monthsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthText: { fontSize: 12, fontWeight: '600' },
  seasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  seasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  seasonChipText: { fontSize: 14, fontWeight: '600' },
  strategyRow: { gap: 10, marginTop: 8 },
  strategyOption: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  strategyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  strategySub: { fontSize: 13, lineHeight: 18 },
});
