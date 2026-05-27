import { View, Text, Pressable, Image } from "react-native";

export default function DiaryPhotoGrid({ photoUris, onRemove, onAdd, styles }: {
  photoUris: string[];
  onRemove: (i: number) => void;
  onAdd: () => void;
  styles: Record<string, any>;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>사진 ({photoUris.length}장)</Text>
      <View style={styles.photoGrid}>
        {photoUris.map((uri, i) => (
          <View key={i} style={styles.photoThumbWrap}>
            <Image source={{ uri }} style={styles.photoThumb} />
            <Pressable style={styles.photoRemove} onPress={() => onRemove(i)}>
              <Text style={styles.photoRemoveText}>×</Text>
            </Pressable>
            {i === 0 && photoUris.length > 1 && (
              <View style={styles.photoRepBadge}>
                <Text style={styles.photoRepBadgeText}>대표</Text>
              </View>
            )}
          </View>
        ))}
        <Pressable style={styles.photoAddBtn} onPress={onAdd}>
          <Text style={styles.photoAddIcon}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
