// PrimaryButton.tsx
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { BUTTON, BUTTON_TEXT, FONT_FAMILY, COLORS } from '@/constants/theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger'; // optional
  disabled?: boolean;
};

export function PrimaryButton({ title, onPress, variant = 'primary', disabled }: Props) {
  const bgColor =
    variant === 'primary' ? BUTTON.primary.bg :
    variant === 'danger' ? BUTTON.danger.bg :
    BUTTON.secondary.bg; // optional secondary

  const textColor =
    variant === 'primary' ? BUTTON.primary.text :
    variant === 'danger' ? BUTTON.danger.text :
    BUTTON.secondary.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bgColor },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.text, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: BUTTON.height,
    borderRadius: BUTTON.radius,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontFamily: FONT_FAMILY?.sansMedium,
  },
});

