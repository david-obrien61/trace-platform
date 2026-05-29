export const CameraView = () => null;
export const useCameraPermissions = () => [null, () => Promise.resolve({ granted: false })];
export default { CameraView, useCameraPermissions };
