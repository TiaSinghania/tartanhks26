import { Pressable, Text, StyleSheet } from 'react-native';
import { BUTTON, BUTTON_TEXT } from '@/constants/theme';

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
};

export function PrimaryButton({ title, onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: BUTTON.height,
    backgroundColor: BUTTON.primary.bg,
    borderRadius: BUTTON.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  pressed: {
    backgroundColor: BUTTON.primary.bgPressed,
  },

  disabled: {
    opacity: 0.5,
  },

  text: {
    ...BUTTON_TEXT,
    color: BUTTON.primary.text,
  },
});
