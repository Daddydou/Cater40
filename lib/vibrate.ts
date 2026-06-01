export const vibrate = {
  success: () => navigator.vibrate?.([100]),
  error:   () => navigator.vibrate?.([50, 50, 50]),
  victory: () => navigator.vibrate?.([200, 100, 200, 100, 400]),
};
