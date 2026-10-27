import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * How much of the screen the keyboard is covering, in dp. Zero when it is down.
 *
 * KeyboardAvoidingView is the usual answer and it does not work inside an Android Modal. A Modal
 * is its own window, and the activity's adjustResize applies to the activity — so the sheet is
 * laid out against a screen height that has not changed, and the field stays underneath the
 * keyboard exactly as before. That is why the first fix for this made no difference on a real
 * phone while looking correct on iOS.
 *
 * Measuring the keyboard and moving the content ourselves sidesteps the whole question of which
 * window got resized, and behaves the same on both platforms.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS reports Will* before the animation, which lets the sheet travel with the keyboard
    // rather than snapping after it. Android only emits Did*.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
