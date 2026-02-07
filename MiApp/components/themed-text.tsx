import { TYPE } from '@/constants/theme';
import { Text, type TextProps } from 'react-native';

export type ThemedTextProps = TextProps & {
  type?: 'body' | 'bodyStrong' | 'title' | 'subtitle' | 'mono';
};

export function ThemedText({
  style,
  type = 'body',
  ...rest
}: ThemedTextProps) {
  return <Text style={[TYPE[type], style]} {...rest} />;
}
