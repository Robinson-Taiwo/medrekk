import Svg, { Path } from 'react-native-svg';

/**
 * The MedRekk mark, the same geometry the website uses so the app and the site are one brand.
 *
 * Drawn rather than loaded from a PNG: it takes a colour, so the green mark on a light screen
 * and the pale mark on an ink one are the same component, with no second asset and no flash
 * while an image decodes.
 */
export function Mark({ size = 28, color = '#0F6E56' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" accessibilityRole="image">
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.7998 102.4V25.6L36.7998 12.8L63.9998 51.2001L91.1998 12.8L115.2 25.6V102.4H92.7998V52.8L63.9998 92.8L35.1998 52.8V102.4H12.7998Z"
      />
      <Path fill={color} fillRule="evenodd" clipRule="evenodd" d="M48 105.6H80V115.2H48V105.6Z" />
    </Svg>
  );
}
