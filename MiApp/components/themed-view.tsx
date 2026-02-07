import { View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedViewProps = ViewProps & {
  darkColor?: string;
};

export function ThemedView({ style, darkColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColor({ dark: darkColor }, 'background');

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
