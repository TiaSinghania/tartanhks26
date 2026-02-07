import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, BUTTON, BUTTON_TEXT, FONT_FAMILY } from '@/constants/theme';

type AlertButton = {
  text: string;
  onPress: () => void;
  type?: 'primary' | 'secondary' | 'danger';
};

type Props = {
  visible: boolean;
  title: string;
  message: string;
  buttons?: AlertButton[];
};

export function CustomAlert({ visible, title, message, buttons = [] }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonRow}>
            {buttons.map((b, i) => (
              <Pressable
                key={i}
                onPress={b.onPress}
                style={[
                  styles.button,
                  b.type === 'primary' && styles.primary,
                  b.type === 'danger' && styles.danger,
                ]}
              >
                <Text style={styles.buttonText}>{b.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // dim background
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 20,
  },
  title: {
    fontFamily: FONT_FAMILY?.sansMedium,
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  message: {
    fontFamily: FONT_FAMILY?.sans,
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    height: BUTTON.height,
    borderRadius: BUTTON.radius,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primary: {
    backgroundColor: BUTTON.primary.bg,
  },
  danger: {
    backgroundColor: BUTTON.danger.bg,
  },
  buttonText: {
    ...BUTTON_TEXT,
    color: '#101412', // dark-on-light for primary buttons
  },
});
